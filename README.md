# @lmcd/gulp-dartsass

[![Build](https://github.com/lachlanmcdonald/gulp-dartsass/actions/workflows/build.yml/badge.svg?branch=main)][build-link] [![npm version](https://badge.fury.io/js/%40lmcd%2Fgulp-dartsass.svg)][package-link] [![License](https://img.shields.io/badge/License-MIT-blue.svg)][license-link] 

**gulp-dartsass** is a [Sass]-wrapper for [Gulp] with support for the modern API's custom file importers and functions.

## Installation

To use **gulp-dartsass**, you must install both **gulp-dartsass** itself and the [**sass** package][sass-npm].

```sh
npm install --save-dev @lmcd/gulp-dartsass sass
```

## Usage

**gulp-dartsass** supports both _sync_ and _async_ compilation. You should only use async compilation when utilising async custom importers. Otherwise, sync compilation is preferred for speed.

For _sync compilation_:

```js
const { src, dest } = require('gulp');
const { sync } = require('@lmcd/gulp-dartsass');
const sass = require('sass');

function compile() {
  return src('./sass/**/*.scss')
    .pipe(sync(sass))
    .pipe(dest('./css'));
};

exports.styles = compile;
```

Or for _async compilation_:

```js
const { src, dest } = require('gulp');
const { async } = require('@lmcd/gulp-dartsass');
const sass = require('sass');

function compile() {
  return src('./sass/**/*.scss')
    .pipe(async(sass))
    .pipe(dest('./css'));
};

exports.styles = compile;
```

### API

**gulp-dartsass** exports both a sync and async factory method with the following signature:

```js
(sass: SassCompiler, options?: Record<string, any>)
```

Where:

- `SassCompiler` must be the [**sass** package][sass-npm].
- `options` can be any key-value pairs, but as these are passed directly to Sass, should use the [`StringOptionsWithImporter`](https://sass-lang.com/documentation/js-api/interfaces/stringoptionswithimporter/) options accepted by Sass.

### Sourcemaps

Gulp's `src` and `dest` built-in support for sourcemaps is the preferred way to use include sourcemaps in your output. However, **gulp-dartsass** will also function with [gulp-sourcemaps].

```js
const { src, dest } = require('gulp');
const { sync } = require('@lmcd/gulp-dartsass');
const sass = require('sass');
 
.src('./sass/**/*.scss', { sourcemaps: true })
  .pipe(sync())
  .pipe(dest('./css', { sourcemaps: true }));
```

### Tests

Tests are written with [Jest](https://jestjs.io/). However, as the virtualisation employed by Jest is not presently compatible with Sass, [jest-light-runner](https://github.com/nicolo-ribaudo/jest-light-runner) is used as the runner.

### Implementation notes

- This plugin does not support legacy/deprecated versions of sass, such as LibSass/Node Sass. Nor does it support Gulp versions earlier than Gulp 4.
- This plugin does not support Sass's legacy API options.
- Passing a character-encodings other than UTF-8 is not explicitly disallowed, but the results are indeterminate.

## License

This repository is licensed under the [MIT license][license-link].

[sass-npm]: https://www.npmjs.com/package/sass
[Sass]: https://sass-lang.com/
[Gulp]: https://gulpjs.com/
[gulp-sourcemaps]: https://www.npmjs.com/package/gulp-sourcemaps
[license-link]: https://github.com/lachlanmcdonald/gulp-dartsass/blob/main/LICENSE
[build-link]: https://github.com/lachlanmcdonald/gulp-dartsass/actions
[package-link]: https://www.npmjs.com/package/@lmcd/gulp-dartsass
