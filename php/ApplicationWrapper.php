<?php namespace GlobalTechnology\MPDDashboard {

	// Require phpCAS, composer does not autoload it.
	require_once( dirname( dirname( __FILE__ ) ) . '/vendor/jasig/phpcas/source/CAS.php' );

	class ApplicationWrapper {
		/**
		 * Singleton instance
		 * @var ApplicationWrapper
		 */
		private static $instance;

		/**
		 * Returns the Plugin singleton
		 * @return ApplicationWrapper
		 */
		public static function singleton() {
			if ( ! isset( self::$instance ) ) {
				$class          = __CLASS__;
				self::$instance = new $class();
			}
			return self::$instance;
		}

		/**
		 * Prevent cloning of the class
		 * @internal
		 */
		private function __clone() {
		}

		public $casClient;
		public $url;
		public $path;

		/**
		 * Constructor
		 */
		private function __construct() {
			//Load config
			$configDir = dirname( dirname( __FILE__ ) ) . '/config';
			Config::load( require $configDir . '/config.php', require $configDir . '/defaults.php' );

			//Generate Current URL taking into account forwarded proto
			$url = \Net_URL2::getRequested();
			$url->setQuery( false );
			$url->setPath( dirname( $_SERVER[ 'PHP_SELF' ] ) );
			if ( isset( $_SERVER[ 'HTTP_X_FORWARDED_PROTO' ] ) )
				$url->setScheme( $_SERVER[ 'HTTP_X_FORWARDED_PROTO' ] );
			$this->url = $url;
			$this->path = $this->url->getPath();

			// Initialize phpCAS proxy client
			$this->casClient = $this->initializeCAS();
		}

		private function initializeCAS() {
			$casClient = new \CAS_Client(
				CAS_VERSION_2_0,
				true,
				Config::get( 'cas.hostname' ),
				Config::get( 'cas.port' ),
				Config::get( 'cas.context' )
			);
			$casClient->setNoCasServerValidation();

			if ( true === Config::get( 'pgtservice.enabled', false ) ) {
				$casClient->setCallbackURL( Config::get( 'pgtservice.callback' ) );
				$casClient->setPGTStorage( new ProxyTicketServiceStorage( $casClient ) );
			}
			else {
				$casClient->setCallbackURL( $this->url->getURL() . '/callback.php' );
				$casClient->setPGTStorageFile( session_save_path() );
				// Handle logout requests but do not validate the server
				$casClient->handleLogoutRequests( false );
			}

			// Accept all proxy chains
			$casClient->getAllowedProxyChains()->allowProxyChain( new \CAS_ProxyChain_Any() );

			return $casClient;
		}

		public function getAPIServiceTicket( $service = false ) {
			return $this->casClient->retrievePT( $service ? $service : ( Config::get( 'mpd-dashboard.endpoint' ) . '/token' ), $code, $msg );
		}

		public function authenticate() {
			$this->casClient->forceAuthentication();
		}

		public function logout() {
			$this->casClient->logout( array() );
		}

		public function appConfig() {
			return json_encode( array(
				'version'     => Config::get( 'application.version', '' ),
				'environment' => Config::get( 'application.environment', 'production' ),
				'appUrl'      => $this->path . '/app',
				'api'         => array(
					'casAuthApi'   => Config::get( 'cas-auth-api.endpoint' ),
					'mpdDashboard' => Config::get( 'mpd-dashboard.endpoint' ),
					'refresh'      => $this->url->getURL() . '/ticket.php',
					'logout'       => Config::get( 'pgtservice.enabled' )
						? $this->url->getURL() . '/logout.php'
						: $this->casClient->getServerLogoutURL(),
					'login'        => $this->casClient->getServerLoginURL(),
				),
			) );
		}
	}
}
