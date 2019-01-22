'use strict';

var fs = require('fs');

var gulp = require('gulp');
var tasks = require('gulp-load-plugins')({scope: ['devDependencies']});

var plumber = tasks.plumber;

function lint() {
  var jshint = tasks.jshint,
      stylish = require('jshint-stylish'),
      config = JSON.parse(String(fs.readFileSync('./.jshintrc', 'utf8')));

  return gulp.src(['./gulpfile.js', './index.js', './test/sloc.test.js'])
    .pipe(plumber())
    .pipe(jshint(config))
    .pipe(jshint.reporter(stylish))
    .pipe(jshint.reporter('fail'));
}

function test() {
  return gulp.src('./test/**/*.js')
    .pipe(plumber())
    .pipe(tasks.mocha({reporter: 'spec'}));
}

function slocFunction() {
  var sloc = require('./index');

  return gulp.src(['./gulpfile.js', './index.js'])
      .pipe(plumber())
      .pipe(sloc());
}
slocFunction.displayName = 'sloc';
gulp.task(slocFunction);

function watch() {
  gulp.watch(['./gulpfile.js', './index.js'], function (event) {
    console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
    gulp.start('sloc');
  });
}
gulp.task('default', gulp.series(slocFunction, watch));

exports.lint = lint;
exports.test= test;
exports.sloc = slocFunction;
exports.ci = gulp.series(
    gulp.parallel(
	lint,
	test),
    slocFunction);
