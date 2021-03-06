'use strict';

var gulp        = require( 'gulp' ),
	bower       = require( 'gulp-bower' ),
	del         = require( 'del' ),
	cdnizer     = require( 'gulp-cdnizer' ),
	htmlreplace = require( 'gulp-html-replace' ),
	minifyHTML  = require( 'gulp-minify-html' ),
	concat      = require( 'gulp-concat' ),
	ngAnnotate  = require( 'gulp-ng-annotate' ),
	uglify      = require( 'gulp-uglify' ),
	minifyCSS   = require( 'gulp-minify-css' ),
	ngHtml2Js   = require( 'gulp-ng-html2js' ),
	sourcemaps  = require( 'gulp-sourcemaps' ),
	path        = require( 'path' ),
	crypto      = require( 'crypto' ),
	less        = require( 'gulp-less' ),
	gettext     = require( 'gulp-angular-gettext' ),
	url         = require( 'url' ),
	request     = require( 'request' ),
	revisions   = {};

function revisionMap() {

	function md5( str ) {
		return crypto.createHash( 'md5' ).update( str ).digest( 'hex' ).slice( 0, 8 );
	}

	function saveRevision( file, callback ) {
		revisions[file.relative] = file.relative + '?rev=' + md5( file.contents );
		callback( null, file );
	}

	return require( 'event-stream' ).map( saveRevision );
}

function uploadToOneSky() {
	var onesky = require( './onesky.json' ),
		ts     = Math.floor( new Date() / 1000 );

	function uploadPOTFile( file, callback ) {
		//https://github.com/onesky/api-documentation-platform/blob/master/resources/file.md#upload---upload-a-file
		request.post( {
			url:      url.format( {
				protocol: 'https',
				host:     'platform.api.onesky.io',
				pathname: '/1/projects/' + onesky.project_id + '/files',
				query:    {
					api_key:   onesky.api_key,
					timestamp: ts,
					dev_hash:  crypto.createHash( 'md5' ).update( ts + onesky.api_secret ).digest( 'hex' )
				}
			} ),
			formData: {
				file:        {
					value:   file.contents,
					options: {
						filename: file.relative
					}
				},
				file_format: 'GNU_POT'
			}
		}, function ( err, httpResponse, body ) {
			if ( err ) {
				callback( err );
			}
			callback( null, file );
		} );
	}

	return require( 'event-stream' ).map( uploadPOTFile );
}

gulp.task( 'clean', function ( callback ) {
	del( ['dist'], callback );
} );

gulp.task( 'html', ['clean', 'bower', 'scripts', 'library', 'partials', 'styles', 'htaccess'], function () {
	return gulp.src( 'src/*.php' )
		.pipe( cdnizer( {
			allowMin: true,
			files:    [
				// JavaScript
				'google:jquery',
				'google:angular-loader',
				'google:angular-resource',
				'google:angular',
				{
					file:    'bower_components/angular-bootstrap/*.js',
					package: 'angular-bootstrap',
					cdn:     'cdnjs:angular-ui-bootstrap:${ filenameMin }'
				},
				{
					file:    'bower_components/angular-ui-router/**/*.js',
					package: 'angular-ui-router',
					cdn:     'cdnjs:angular-ui-router:${ filenameMin }'
				},
				{
					file:    'bower_components/moment/*.js',
					package: 'moment',
					cdn:     'cdnjs:moment.js:${ filenameMin }'
				},
				{
					file:    'bower_components/underscore/underscore.js',
					package: 'underscore',
					cdn:     'cdnjs:underscore.js:underscore-min.js'
				},
				{
					file:    'bower_components/angular-google-chart/ng-google-chart.js',
					package: 'angular-google-chart',
					cdn:     '//cdnjs.cloudflare.com/ajax/libs/angular-google-chart/${ version }/ng-google-chart.min.js'
				},

				// CSS
				{
					file:    'bower_components/bootstrap/**/*.css',
					package: 'bootstrap',
					cdn:     'cdnjs:twitter-bootstrap:css/${ filenameMin }'
				},
				{
					file:    'bower_components/bootswatch/superhero/bootstrap.css',
					package: 'bootswatch',
					cdn:     '//maxcdn.bootstrapcdn.com/bootswatch/${ version }/superhero/bootstrap.min.css'
				}
			]
		} ) )
		.pipe( htmlreplace( {
			application: [
				'js/' + revisions['app.min.js'],
				'js/' + revisions['templates.min.js']
			],
			library:     'js/' + revisions['library.min.js'],
			styles:      'css/' + revisions['styles.min.css']
		} ) )
		.pipe( gulp.dest( 'dist' ) );
} );

gulp.task( 'scripts', ['clean'], function () {
	return gulp.src( ['src/app/**/*.module.js', 'src/app/**/*.state.js', 'src/app/**/*.js'] )
		.pipe( sourcemaps.init() )
		.pipe( concat( 'app.min.js' ) )
		.pipe( ngAnnotate() )
//		.pipe( uglify() )
		.pipe( revisionMap() )
		.pipe( sourcemaps.write( '.' ) )
		.pipe( gulp.dest( 'dist/js' ) );
} );

/* Library Task - Script files not available in CDN */
gulp.task( 'library', ['clean', 'bower'], function () {
	return gulp.src( [
			'src/bower_components/angular-gettext/dist/angular-gettext.js',
			'src/bower_components/angular-growl-v2/build/angular-growl.js',
			'src/bower_components/lscache/lscache.js',
			'src/bower_components/angular-cas-auth-api/dist/cas-auth-api.js'
		] )
		.pipe( sourcemaps.init() )
		.pipe( concat( 'library.min.js' ) )
		.pipe( ngAnnotate() )
		.pipe( uglify() )
		.pipe( revisionMap() )
		.pipe( sourcemaps.write( '.' ) )
		.pipe( gulp.dest( 'dist/js' ) );
} );

gulp.task( 'partials', ['clean'], function () {
	return gulp.src( ['src/app/**/*.html'] )
		.pipe( sourcemaps.init() )
		.pipe( minifyHTML() )
		.pipe( ngHtml2Js( {
			moduleName:    'mpdDashboard',
			prefix:        'app/',
			declareModule: false
		} ) )
		.pipe( concat( 'templates.min.js' ) )
		.pipe( uglify() )
		.pipe( revisionMap() )
		.pipe( sourcemaps.write( '.' ) )
		.pipe( gulp.dest( 'dist/js' ) );
} );

gulp.task( 'styles', ['clean', 'less'], function () {
	return gulp.src( ['src/app/**/*.css'] )
		.pipe( concat( 'styles.min.css' ) )
		.pipe( minifyCSS() )
		.pipe( revisionMap() )
		.pipe( gulp.dest( 'dist/css' ) );
} );

gulp.task( 'images', ['clean'], function () {
	return gulp.src( ['src/app/img/**/*.png'] )
		.pipe( gulp.dest( 'dist/app/img' ) );
} );

gulp.task( 'htaccess', ['clean'], function () {
	return gulp.src( 'src/.htaccess' )
		.pipe( gulp.dest( 'dist' ) );
} );

gulp.task( 'bower', function () {
	return bower();
} );

gulp.task( 'build', ['images', 'html'] );

gulp.task( 'default', ['build'] );

gulp.task( 'less', function () {
	return gulp.src( ['src/app/app.imports.less', 'src/app/**/*.less'] )
		.pipe( concat( 'app.css' ) )
		.pipe( less() )
		.pipe( gulp.dest( 'src/app/css' ) );
} );

gulp.task( 'watch', function () {
	gulp.watch( ['src/app/app.imports.less', 'src/app/**/*.less'], ['less'] );
} );

gulp.task( 'pot', function () {
	return gulp.src( ['src/app/**/*.html', 'src/app/**/*.js'] )
		.pipe( gettext.extract( 'mpd-calculator.pot', {} ) )
		.pipe( gulp.dest( 'src/languages/' ) );
} );

gulp.task( 'onesky', ['pot'], function () {
	return gulp.src( 'src/languages/mpd-calculator.pot' )
		.pipe( uploadToOneSky() );
} );
