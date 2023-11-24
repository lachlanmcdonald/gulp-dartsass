const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const TEST_SCRIPT_PATH = path.join(__dirname, '..', 'index.test.js');
const PACKAGE_NAME = 'sass';
const METADATA_URL = `https://registry.npmjs.org/${PACKAGE_NAME}`;
const DATA_URL = `https://api.npmjs.org/versions/${PACKAGE_NAME}/last-week`;

// Function to download a file
const fetch = url => {
	return new Promise((resolve, reject) => {
		https.get(url, response => {
			let data = '';

			response.on('data', chunk => {
				data += chunk;
			});

			response.on('end', () => {
				resolve(JSON.parse(data));
			});
		}).on('error', err => {
			reject(err);
		});
	});
};

Promise.all([
	fetch(METADATA_URL),
	fetch(DATA_URL),
]).then(([metadata, downloadData]) => {
	// Get three most recent versions
	const recentVersions = Object.keys(metadata.versions).slice(-10);

	// Get eight of the top downloaded versions this week
	// const topVersions = Object.entries(downloadData.downloads).sort((a, b) => {
	// 	return b[1] - a[1];
	// }).slice(0, 8).map(x => x[0]);

	// Target versions
	const targetVersions = new Set([...recentVersions/* , ...topVersions */]);

	// Parse package.json and remove the existing sass dependencies
	const package = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));

	Object.keys(package.devDependencies).forEach(key => {
		if (/^sass-.+$/.test(key)) {
			delete package.devDependencies[key];
		}
	});

	// Avoid installing the existing sass version twice
	targetVersions.delete(package.devDependencies.sass.replace('^', ''));

	// Add dependencies for new versions
	targetVersions.forEach(version => {
		package.devDependencies[`sass-${version}`] = `npm:sass@${version}`;
	});

	// Update package.json
	fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(package, null, 2), 'utf-8');

	// Read test script
	const pattern = /\/\/ DO NOT UPDATE BELOW.*\/\/ DO NOT UPDATE ABOVE[^\n]+/gis;
	let testScript = fs.readFileSync(TEST_SCRIPT_PATH, 'utf-8');

	const testUpdates = [
		'// DO NOT UPDATE BELOW - THIS SECTION IS AUTOMATICALLY GENERATED',
		"const sass = require('sass');",
		...Array.from(targetVersions).map(version => {
			const name = `sass_${version}`.replace(/\./g, '_');

			return `const ${name} = require('sass-${version}'); // ${version}`;
		}).sort(),
		'',
		'const SASS_VERSIONS = {',
		...Array.from(targetVersions).map(version => {
			const name = `sass_${version}`.replace(/\./g, '_');

			return `\t'${version}': ${name},`;
		}).sort(),
		'};',
		'// DO NOT UPDATE ABOVE - THIS SECTION IS AUTOMATICALLY GENERATED',
	];

	testScript = testScript.replace(pattern, testUpdates.join('\n'));

	fs.writeFileSync(TEST_SCRIPT_PATH, testScript, 'utf-8');
});
