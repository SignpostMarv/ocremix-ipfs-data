const gulp = require('gulp');
const postcss = require('gulp-postcss');
const changed = require('gulp-changed');
const htmlmin = require('gulp-htmlmin');
const newer = require('gulp-newer');
const purgecss = require('gulp-purgecss');
const typescript = require('gulp-typescript');
const replace = require('gulp-replace');
const rename = require('gulp-rename');
const eslint = require('gulp-eslint');
const filter = require('gulp-filter');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require('gulp-uglify-es').default;

const postcss_plugins = {
	nested: require('postcss-nested'),
	calc: require('postcss-nested'),
	font_family_system_ui: require('postcss-font-family-system-ui'),
	system_monospace: require('postcss-system-monospace'),
	cssnano: require('cssnano'),
	import: require('postcss-import'),
};

const postcss_config = () => {
	return postcss([
		postcss_plugins.import(),
		postcss_plugins.nested(),
		postcss_plugins.calc(),
		postcss_plugins.font_family_system_ui(),
		postcss_plugins.system_monospace(),
		postcss_plugins.cssnano({
			cssDeclarationSorter: 'concentric-css',
			discardUnused: true,
		}),
	]);
};

gulp.task('cache-ipfs-tree-as-json', async () => {
	const ipfs = await require('ipfs').create();

	return new Promise(async (yup, nope) => {
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
				'QmRtn5sM1j9xaKUZZaBQaKTNAP1Wn2PQ1R8YbBndXF2q5E'
			);

			const fs = require('fs');

			fs.writeFile(
				'./dist/data/ocremix-cids.json',
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
			nope(err);
		}
	}).finally(() => {
		try {
			ipfs.stop();
		} catch (err) {
			console.error(err);
		}
	});
});

gulp.task('css--style', () => {
	return gulp.src(
		'./src/css/style.css'
	).pipe(
		newer('./tmp/css/')
	).pipe(
		postcss_config()
	).pipe(gulp.dest(
		'./tmp/css/'
	));
});

gulp.task('css--first-load', () => {
	return gulp.src(
		'./src/css/style.css'
	).pipe(
		newer('./tmp/css/')
	).pipe(
		postcss_config()
	).pipe(purgecss({
		content: [
			'./tmp/**/*.html'
		],
		rejected: false,
	})).pipe(
		rename('first-load.css')
	).pipe(gulp.dest(
		'./tmp/css/'
	));
});

gulp.task('html', () => {
	return gulp.src('./src/**/*.html').pipe(
		newer('./tmp/')
	).pipe(htmlmin({
		collapseBooleanAttributes: true,
		collapseInlineTagWhitespace: false,
		collapseWhitespace: true,
		decodeEntities: true,
		sortAttributes: true,
		maxLineLength: 79,
	})).pipe(gulp.dest(
		'./tmp/'
	));
});

gulp.task('ts', () => {
	return gulp.src(
		'./src/{js,data}/**/*.ts'
	).pipe(
		filter([
			'**',
			'!**/*.worker.ts',
		])
	).pipe(
		eslint({
			configFile: './.eslint.js',
		})
	).pipe(
		eslint.format()
	).pipe(
		eslint.failAfterError()
	).pipe(newer({
		dest: './tmp/',
		ext: '.js',
	})).pipe(
		typescript.createProject('./tsconfig.json')()
	).pipe(
		replace(/\ {4}/g, '\t')
	).pipe(gulp.dest(
		'./tmp/'
	));
});

gulp.task('ts--workers', () => {
	return gulp.src(
		'./src/{js,data}/**/*.worker.ts'
	).pipe(
		eslint({
			configFile: './.eslint.js',
		})
	).pipe(
		eslint.format()
	).pipe(
		eslint.failAfterError()
	).pipe(newer({
		dest: './tmp/',
		ext: '.js',
	})).pipe(
		typescript.createProject('./tsconfig.workers.json')()
	).pipe(
		replace(/\ {4}/g, '\t')
	).pipe(gulp.dest(
		'./tmp/'
	));
});

gulp.task('sync--ipfs', () => {
	return gulp.src('./node_modules/ipfs/dist/**/*.*').pipe(
		changed(
			'./dist/ipfs/',
			{
				hasChanged: changed.compareContents
			}
		)
	).pipe(gulp.dest(
		'./dist/ipfs/'
	));
});

gulp.task('sync--ipfs--build-module', () => {
	return gulp.src('./node_modules/ipfs/dist/index.js').pipe(
		sourcemaps.init({loadMaps: true})
	).pipe(
		replace(
			'(function webpackUniversalModuleDefinition(root, factory) {',
			(
				'const notWindow = {};' +
				'\n' +
				'(function webpackUniversalModuleDefinition(root, factory) {'
			)
		)
	).pipe(
		replace(
			'})(window, function() {',
			'})(notWindow, function() {'
		)
	).pipe(
		replace(
			(
				'/******/ ]);' +
				'\n' +
				'});'
			),
			(
				'/******/ ]);' +
				'\n' +
				'});' +
				'\n' +
				'export const Ipfs = notWindow[\'Ipfs\'];' +
				'\n' +
				'export default notWindow[\'Ipfs\'];'
			)
		)
	).pipe(
		rename('index.module.js')
	).pipe(
		sourcemaps.write('./')
	).pipe(
		gulp.dest('./dist/ipfs/')
	)
});

gulp.task('sync--ipfs--minify-module', () => {
	return gulp.src('./dist/ipfs/index.module.js').pipe(
		sourcemaps.init({loadMaps:true})
	).pipe(
		rename('index.module.min.js')
	).pipe(uglify()).pipe(sourcemaps.write('./')).pipe(
		gulp.dest('./dist/ipfs/')
	);
});

gulp.task('sync--lit-html', () => {
	return gulp.src('./node_modules/lit-html/**/*.*').pipe(
		changed(
			'./dist/lit-html/',
			{
				hasChanged: changed.compareContents
			}
		)
	).pipe(gulp.dest(
		'./dist/lit-html/'
	)).pipe(gulp.dest(
		'./src/lit-html/'
	));
});

gulp.task('sync', () => {
	return gulp.src('./tmp/**/*.*').pipe(
		changed(
			'./dist/',
			{
				hasChanged: changed.compareContents
			}
		)
	).pipe(gulp.dest(
		'./dist/'
	));
});

gulp.task('default', gulp.series(
	gulp.parallel(
		'html',
		'ts',
		'ts--workers',
		'sync--lit-html',
		'sync--ipfs',
		'sync--ipfs--build-module'
	),
	gulp.parallel(
		'sync--ipfs--minify-module',
		'css--first-load',
		'css--style'
	),
	'sync'
));
