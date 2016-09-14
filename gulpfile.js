'use strict';

var fs = require('fs');

var gulp = require('gulp');
var tasks = require('gulp-load-plugins')({scope: ['devDependencies']});

var plumber = tasks.plumber;

gulp.task('lint', function () {
  var jshint = tasks.jshint,
      stylish = require('jshint-stylish'),
      config = JSON.parse(String(fs.readFileSync('./.jshintrc', 'utf8')));

  return gulp.src(['./gulpfile.js', './index.js', './test/sloc.test.js'])
    .pipe(plumber())
    .pipe(jshint(config))
    .pipe(jshint.reporter(stylish))
    .pipe(jshint.reporter('fail'));
});

gulp.task('test', ['lint'], function () {
  return gulp.src('./test/**/*.js')
    .pipe(plumber())
    .pipe(tasks.mocha({reporter: 'spec'}));
});

var slocFunction = function () {
  var sloc = require('./index');

  return gulp.src(['./gulpfile.js', './index.js'])
      .pipe(plumber())
      .pipe(sloc());
};
gulp.task('sloc', ['test'], slocFunction);
gulp.task('sloc-dev', slocFunction);

gulp.task('default', ['sloc'], function () {
  gulp.watch(['./gulpfile.js', './index.js'], function (event) {
    console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
    gulp.start('sloc');
  });
});

gulp.task('ci', ['sloc'], function () {});
