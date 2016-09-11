'use strict';

var path = require('path');
var util = require('util');

var _ = require('lodash');
var expect = require('expect.js');
var gutil = require('gulp-util');

var File = gutil.File;
var colors = gutil.colors;
var interceptStdout = require('./intercept_stdout');

var sloc = require('../');

function makeFakeFile(filePath, contents) {
  return new File({
    cwd: path.dirname(path.dirname(filePath)),
    base: path.dirname(path.dirname(filePath)),
    path: filePath,
    contents: new Buffer((contents || ''))
  });
}

function validateOutputLine(metric, line, value) {
  // prepare expected value based on metric's spec
  var expectedSubstringFormat = '  ' + metric.label + ' : %s';
  if (metric.hasOwnProperty('filter')) {
    value = metric.filter(value);
  }
  var expectedSubstring = util.format(expectedSubstringFormat, value);

  // assert
  expect(line).to.contain(expectedSubstring);
}

function validateOutput(lines, counters, strict, elements) {
  elements = _.extend({
    mode: true,
    before: '-------------------------------',  
    after: '-------------------------------'  
  }, elements || {});

  // all metrics in expected order - only ones that should be present will be checked
  var metrics = [
    {
      name: 'total',
      label: 'physical lines',
      filter: colors.green
    },
    {
      name: 'source',
      label: 'lines of source code',
      filter: colors.green
    },
    {
      name: 'comment',
      label: 'total comment',
      filter: colors.cyan
    },
    {
      name: 'single',
      label: 'single-line'
    },
    {
      name: 'block',
      label: 'block'
    },
    {
      name: 'mixed',
      label: 'mixed'
    },
    {
      name: 'empty',
      label: 'empty',
      filter: colors.red
    }
  ];


  var lineIndex = 0;
    
  if (elements.before) {
    expect(lines[lineIndex]).to.contain('] ' + elements.before);
    lineIndex += 1;
  }

  _.each(metrics, function (metric) {
    // ensure that this metric is expected
    if (!counters.hasOwnProperty(metric.name)) {
      return;
    }

    // assert and continue
    validateOutputLine(metric, lines[lineIndex], counters[metric.name]);
    lineIndex += 1;
  });

  // if mode or no. of files should be printed
  if (elements || counters.hasOwnProperty('file')) {
    // skip over this line - assertion is always true, so pointless
    // expect(lines[lineIndex]).to.contain('] ');
    lineIndex += 1;
  }

  // 'file' metric is special because there's an empty line before it
  if (counters.hasOwnProperty('file')) {
    validateOutputLine({
      name: 'file',
      label: 'number of files read',
      filter: colors.green
    }, lines[lineIndex], counters.file);
    lineIndex += 1;
  }

  if (elements.mode) {
    if (strict) {
      expect(lines[lineIndex]).to.contain(util.format(' %s', colors.red('           strict mode ')));
    } else {
      expect(lines[lineIndex]).to.contain(util.format('] %s', colors.yellow('         tolerant mode ')));
    }
    lineIndex += 1;
  }

  if (elements.after) {
    expect(lines[lineIndex]).to.contain('] ' + elements.after);
    lineIndex += 1;
  }
}

describe('gulp-sloc', function () {
  describe('sloc()', function () {
    var writtenValue;

    function updateConsoleValue(value) {
      writtenValue += value;
    }

    beforeEach(function () {
      writtenValue = '';
    });

    it('should calculate sloc in strict mode on a single input file and print to console by default', function (done) {
      var stream = sloc();
      var restoreStdout;

      stream.on('end', function () {
        var lines = writtenValue.split('\n');

        try {
          validateOutput(lines, {total: 1, source: 1, comment: 0, single: 0, block: 0, mixed: 0, empty: 0, file: 1}, true);

          restoreStdout();
          done();
        } catch (e) {
          restoreStdout();
          return done(e);
        }
      });

      restoreStdout = interceptStdout(updateConsoleValue);
      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.end();
    });

    it('should calculate sloc in strict mode on all specified input files and print to console by default', function (done) {
      var stream = sloc();
      var restoreStdout;

      stream.on('error', function () {
        console.log('Error!');
      });

      stream.on('end', function () {
        var lines = writtenValue.split('\n');

        try {
          validateOutput(lines, {total: 2, source: 2, comment: 0, single: 0, block: 0, mixed: 0, empty: 0, file: 2}, true);

          restoreStdout();
          done();
        } catch (e) {
          restoreStdout();
          return done(e);
        }
      });

      restoreStdout = interceptStdout(updateConsoleValue);
      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.write(makeFakeFile('/a/b/boo.js', 'var a = 10, b= 20;'));
      stream.write(makeFakeFile('/a/b/moo.bak', 'var a = 10, b= 20;'));   // this file should be ignored
      stream.end();
    });

    it('should calculate sloc in tolerant mode on all specified input files and print to console by default', function (done) {
      var stream = sloc({
        tolerant: true
      });
      var restoreStdout;

      stream.on('end', function () {
        var lines = writtenValue.split('\n');

        try {
          validateOutput(lines, {total: 3, source: 3, comment: 0, single: 0, block: 0, mixed: 0, empty: 0, file: 3}, false);

          restoreStdout();
          done();
        } catch (e) {
          restoreStdout();
          return done(e);
        }
      });

      restoreStdout = interceptStdout(updateConsoleValue);
      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.write(makeFakeFile('/a/b/boo.js', 'var a = 10, b= 20;'));
      stream.write(makeFakeFile('/a/b/moo.bak', 'var a = 10, b= 20;'));   // this file not should be ignored
      stream.end();
    });

    it('should calculate sloc in strict mode on all specified input files and send Json file downstream with default filename', function (done) {
      var stream = sloc({
        reportType: 'json'
      });
      var expectedResults = {total: 2, source: 2, comment: 0, single: 0, block: 0, mixed: 0, empty: 0, file: 2};

      stream.on('data', function (file) {
        expect(path.basename(file.path)).to.be('sloc.json');

        var results = JSON.parse(file.contents.toString('utf8'));

        _.each(expectedResults, function (value, key) {
          expect(results[key]).to.be(value);
        });

        done();
      });

      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.write(makeFakeFile('/a/b/boo.js', 'var a = 10, b= 20;'));
      stream.write(makeFakeFile('/a/b/moo.bak', 'var a = 10, b= 20;'));   // this file should be ignored
      stream.end();
    });

    it('should calculate sloc in strict mode on all specified input files and send Json file downstream with specified filename', function (done) {
      var stream = sloc({
        reportType: 'json',
        reportFile: 'all.json'
      });
      var expectedResults = {total: 2, source: 2, comment: 0, single: 0, block: 0, mixed: 0, empty: 0, file: 2};

      stream.on('data', function (file) {
        expect(path.basename(file.path)).to.be('all.json');

        var results = JSON.parse(file.contents.toString('utf8'));

        _.each(expectedResults, function (value, key) {
          expect(results[key]).to.be(value);
        });

        done();
      });

      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.write(makeFakeFile('/a/b/boo.js', 'var a = 10, b= 20;'));
      stream.write(makeFakeFile('/a/b/moo.bak', 'var a = 10, b= 20;'));   // this file should be ignored
      stream.end();
    });

    it('should calculate sloc in tolerant mode on all specified input files and send Json file downstream with default filename', function (done) {
      var stream = sloc({
        tolerant: true,
        reportType: 'json'
      });
      var expectedResults = {total: 3, source: 3, comment: 0, single: 0, block: 0, mixed: 0, empty: 0, file: 3};

      stream.on('data', function (file) {
        expect(path.basename(file.path)).to.be('sloc.json');

        var results = JSON.parse(file.contents.toString('utf8'));

        _.each(expectedResults, function (value, key) {
          expect(results[key]).to.be(value);
        });

        done();
      });

      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.write(makeFakeFile('/a/b/boo.js', 'var a = 10, b= 20;'));
      stream.write(makeFakeFile('/a/b/moo.bak', 'var a = 10, b= 20;'));   // this file should not be ignored
      stream.end();
    });

    it('should calculate sloc in tolerant mode on all specified input files and send Json file downstream with specified filename', function (done) {
      var stream = sloc({
        tolerant: true,
        reportType: 'json',
        reportFile: 'all.json'
      });
      var expectedResults = {total: 3, source: 3, comment: 0, single: 0, block: 0, mixed: 0, empty: 0, file: 3};

      stream.on('data', function (file) {
        expect(path.basename(file.path)).to.be('all.json');

        var results = JSON.parse(file.contents.toString('utf8'));

        _.each(expectedResults, function (value, key) {
          expect(results[key]).to.be(value);
        });

        done();
      });

      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.write(makeFakeFile('/a/b/boo.js', 'var a = 10, b= 20;'));
      stream.write(makeFakeFile('/a/b/moo.bak', 'var a = 10, b= 20;'));   // this file should not be ignored
      stream.end();
    });

    it('should allow for filtering of displayed metrics', function (done) {
      var stream = sloc({
          metrics: ['total', 'source']
      });
      var restoreStdout;

      stream.on('end', function () {
        var lines = writtenValue.split('\n');

        try {
          validateOutput(lines, {total: 1, source: 1}, true);

          restoreStdout();
          done();
        } catch (e) {
          restoreStdout();
          return done(e);
        }
      });

      restoreStdout = interceptStdout(updateConsoleValue);
      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.end();
    });

    it('should not print mode if disabled', function (done) {
      var reportElements = {
        mode: false
      };
      var stream = sloc({
        reportElements: reportElements
      });
      var restoreStdout;

      stream.on('end', function () {
        var lines = writtenValue.split('\n');

        try {
          validateOutput(lines, {total: 1, source: 1, comment: 0, single: 0, block: 0, mixed: 0, empty: 0, file: 1}, true, reportElements);

          restoreStdout();
          done();
        } catch (e) {
          restoreStdout();
          return done(e);
        }
      });

      restoreStdout = interceptStdout(updateConsoleValue);
      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.end();
    });

    it('should not print mode or file count if disabled', function (done) {
      var reportElements = {
        mode: false
      };
      var stream = sloc({
        reportElements: reportElements,
        metrics: ['total']
      });
      var restoreStdout;

      stream.on('end', function () {
        var lines = writtenValue.split('\n');

        try {
          validateOutput(lines, {total: 1}, true, reportElements);

          restoreStdout();
          done();
        } catch (e) {
          restoreStdout();
          return done(e);
        }
      });

      restoreStdout = interceptStdout(updateConsoleValue);
      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.end();
    });

    it('should not print line after report if disabled', function (done) {
      var reportElements = {
        after: false
      };
      var stream = sloc({
        reportElements: reportElements,
        metrics: ['total']
      });
      var restoreStdout;

      stream.on('end', function () {
        var lines = writtenValue.split('\n');

        try {
          validateOutput(lines, {total: 1}, true, reportElements);

          restoreStdout();
          done();
        } catch (e) {
          restoreStdout();
          return done(e);
        }
      });

      restoreStdout = interceptStdout(updateConsoleValue);
      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.end();
    });

    it('should print customized line after report', function (done) {
      var reportElements = {
        after: '--after--'
      };
      var stream = sloc({
        reportElements: reportElements,
        metrics: ['total']
      });
      var restoreStdout;

      stream.on('end', function () {
        var lines = writtenValue.split('\n');

        try {
          validateOutput(lines, {total: 1}, true, reportElements);

          restoreStdout();
          done();
        } catch (e) {
          restoreStdout();
          return done(e);
        }
      });

      restoreStdout = interceptStdout(updateConsoleValue);
      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.end();
    });

    it('should not print line before report if disabled', function (done) {
      var reportElements = {
        before: false
      };
      var stream = sloc({
        reportElements: reportElements,
        metrics: ['total']
      });
      var restoreStdout;

      stream.on('end', function () {
        var lines = writtenValue.split('\n');

        try {
          validateOutput(lines, {total: 1}, true, reportElements);

          restoreStdout();
          done();
        } catch (e) {
          restoreStdout();
          return done(e);
        }
      });

      restoreStdout = interceptStdout(updateConsoleValue);
      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.end();
    });

    it('should print customized line before report', function (done) {
      var reportElements = {
        before: '--before--'
      };
      var stream = sloc({
        reportElements: reportElements,
        metrics: ['total']
      });
      var restoreStdout;

      stream.on('end', function () {
        var lines = writtenValue.split('\n');

        try {
          validateOutput(lines, {total: 1}, true, reportElements);

          restoreStdout();
          done();
        } catch (e) {
          restoreStdout();
          return done(e);
        }
      });

      restoreStdout = interceptStdout(updateConsoleValue);
      stream.write(makeFakeFile('/a/b/foo.js', 'var a = 10;'));
      stream.end();
    });

  });
});
