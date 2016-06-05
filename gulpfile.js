'use strict';

var fs = require('fs');
var path = require('path');
var browserify = require('browserify');
var watchify = require('watchify');
var gulp = require('gulp');
var cleanCSS = require('gulp-clean-css');
var concat = require('gulp-concat');
var jsonminify = require('gulp-jsonminify');
var sourcemaps = require('gulp-sourcemaps');
var streamify = require('gulp-streamify');
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var modifyDoc = require('./src/doc/modifyDoc');

var srcDir = path.join('.', 'src');
var outputDir = path.join('.', 'client');

var bundle = (b, output, outputDir) => {
    return b.bundle()
    .pipe(source(output))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(uglify())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(outputDir))
    .on('error', gutil.log.bind(gutil, 'Browserify Error'));
};

var bundleTask = (watch) => {
    var jsOutputDir = path.join(outputDir, 'js');
    var sources = [{
        entries: [path.join(srcDir, 'js', 'doc.js')],
        output: 'doc.js'
    }];
    return Promise.all(sources.map((source) => {
        if (watch) {
            source = Object.assign({}, watchify.args, source);
        }
        var output = source.output;
        delete source.output;
        var b = browserify(source);
        if (watch) {
            b = watchify(b);
            b.on('update', () => {
                return bundle(b, output, jsOutputDir);
            });
        }
        b.on('log', gutil.log);
        return bundle(b, output, jsOutputDir);
    }));
};

gulp.task('bundle-watch', () => bundleTask(true));
gulp.task('bundle', () => bundleTask(false));

var SWAGGER_UI_PATH = path.join('.', 'node_modules', 'swagger-ui');
if (!fs.statSync(SWAGGER_UI_PATH).isDirectory()) {
    SWAGGER_UI_PATH = path.join('.', 'node_modules', 'swagger-ui-browserify', 'node_modules', 'swagger-ui');
}

gulp.task('api-doc', () => {
    return gulp.src([
        path.join(srcDir, 'doc', 'swagger.json')
    ])
    .pipe(modifyDoc())
    .pipe(jsonminify())
    .pipe(gulp.dest(path.join(outputDir, 'doc')))
    .on('error', gutil.log.bind(gutil, 'API doc Error'));
});

gulp.task('doc-css-print', () => {
    return gulp.src([
        path.join(SWAGGER_UI_PATH, 'dist', 'css', 'reset.css'),
        path.join(SWAGGER_UI_PATH, 'dist', 'css', 'print.css'),
        path.join(SWAGGER_UI_PATH, 'dist', 'css', 'typography.css')
    ])
    .pipe(concat('doc-print.css'))
    .pipe(cleanCSS())
    .pipe(gulp.dest(path.join(outputDir, 'css')));
});

gulp.task('doc-css', ['doc-css-print'], () => {
    return gulp.src([
        path.join(SWAGGER_UI_PATH, 'dist', 'css', 'reset.css'),
        path.join(SWAGGER_UI_PATH, 'dist', 'css', 'screen.css'),
        path.join(SWAGGER_UI_PATH, 'dist', 'css', 'typography.css')
    ])
    .pipe(concat('doc.css'))
    .pipe(cleanCSS())
    .pipe(gulp.dest(path.join(outputDir, 'css')))
});

gulp.task('doc', ['api-doc', 'doc-css']);

gulp.task('fonts', () => {
    return gulp.src([
        path.join(SWAGGER_UI_PATH, 'dist', 'fonts', '*.{eot,svg,ttf,woff,woff2}')
    ])
    .pipe(gulp.dest(path.join(outputDir, 'fonts')))
});

gulp.task('images', () => {
    return gulp.src([
        path.join(SWAGGER_UI_PATH, 'dist', 'images', '*.{png,jpg,gif}')
    ])
    .pipe(gulp.dest(path.join(outputDir, 'images')));
});

gulp.task('watch', ['bundle-watch', 'doc', 'fonts', 'images']);
gulp.task('default', ['bundle', 'doc', 'fonts', 'images']);
