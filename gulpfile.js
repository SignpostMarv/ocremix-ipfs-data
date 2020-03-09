const {
	src,
	dest,
	parallel,
} = require('gulp');
const typescript = require('gulp-typescript');
const rename = require('gulp-rename');
const eslint = require('gulp-eslint');
const filter = require('gulp-filter');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require('gulp-uglify-es').default;
const tsProject = typescript.createProject('./tsconfig.json')();

exports.cacheIpfsTreeAsJson = async (cb) => {
	const ipfs = await require('ipfs').create();

	await new Promise(async (yup, nope) => {
		try {
			async function ReadIpfsDir(
				cid,
				directory_alias = '/'
			) {
				console.log('checking ' + directory_alias);

				const ls = await ipfs.files.ls(
					'/ipfs/' + cid,
					{long:true}
				);

				const dir = {};

				for await(const entry of ls) {
					if (0 === entry.type) {
						dir[directory_alias + entry.name] = entry.cid.toString();
						console.log('got cid for ' + directory_alias + entry.name);
					} else if (1 === entry.type) {
						for (const subentry of Object.entries(await ReadIpfsDir(
							cid + '/' + entry.name,
							directory_alias + entry.name + '/'
						))) {
							dir[subentry[0]] = subentry[1];
						}
					}
				}

				return dir;
			}

			const ocremix = await ReadIpfsDir(
				'QmR1eofNS6jaJu8vpHhSZ5jRXDbpUgs9ku6qHT44ySSTEn'
			);

			const fs = require('fs');

			fs.writeFile(
				'./src/data/ocremix-cids.min.json',
				JSON.stringify(ocremix),
				() => {
					fs.writeFile(
						'./src/data/ocremix-cids.json',
						JSON.stringify(ocremix, null, '\t'),
						() => {
							yup(0);
						}
					)
				}
			);
		} catch (err) {
			yup(err);
		}
	}).then(async (res) => {
		if (0 !== res) {
			console.error(err);
		}

		try {
			await ipfs.stop();
		} catch (err) {
			console.error(err);
		}
	});
};

exports.ts = () => {
	return src('./src/**/*.ts').pipe(
		sourcemaps.init()
	).pipe(
		eslint({
			configFile: './.eslint.js',
		})
	).pipe(
		eslint.format()
	).pipe(
		eslint.failAfterError()
	).pipe(
		tsProject
	).pipe(
		sourcemaps.write('./')
	).pipe(dest(
		'./src/'
	)).pipe(
		filter([
			'**/*.js',
			'!**/*.d.*',
		])
	).pipe(
		sourcemaps.init({loadMaps: true})
	).pipe(
		uglify()
	).pipe(
		sourcemaps.write('./')
	).pipe(dest('./src/'));
};

exports.default = parallel(...[
	exports.ts,
	exports.cacheIpfsTreeAsJson,
]);
