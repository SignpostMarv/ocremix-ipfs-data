const {
	parallel,
} = require('gulp');

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
				'QmY12LCQd5DQBDVUi1Z8QW8tDMimdTwTiGhjNCL8cQkpk4'
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

exports.default = parallel(...[
	exports.cacheIpfsTreeAsJson,
]);
