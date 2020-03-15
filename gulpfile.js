const {
	parallel,
} = require('gulp');

const config = {
	'QmY12LCQd5DQBDVUi1Z8QW8tDMimdTwTiGhjNCL8cQkpk4': './src/data/ocremix-cids.json',
	'QmSRSET4CY6hSEZQ8p2UsQm7gNK4PVCQbGxuNpucMdaRKS': './src/data/OCRA-0006.json',
	'QmRiNyNkaz8qjEYVWGQnzFEqxd5hiKjFZTD3oi59J8eazB': './src/data/OCRA-0008.json',
	'QmeaLLGzEQJ9kpwxoNhCG3honp2faJfKhGrrRvtK8DtxAs': './src/data/OCRA-0025.json',
	'QmXwQvnciFwhWocEp8h4rKM2ytTQDw44ScBRktmRuWSem6': './src/data/OCRA-0029.json',
};
async function ReadIpfsDir(
	ipfs,
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
				ipfs,
				cid + '/' + entry.name,
				directory_alias + entry.name + '/'
			))) {
				dir[subentry[0]] = subentry[1];
			}
		}
	}

	return dir;
}

exports.cacheIpfsTreeAsJson = async (cb) => {
	const ipfs = await require('ipfs').create();

	await new Promise(async (yup, nope) => {
		try {
			const fs = require('fs');

			await Promise.all(Object.entries(config).map(async entry => {
				const [cid, filename] = entry;

				const ocremix = await ReadIpfsDir(ipfs, cid);

				return new Promise(entryDone => {
					fs.writeFile(
						filename.replace(/\.json$/, '.min.json'),
						JSON.stringify(ocremix),
						() => {
							fs.writeFile(
								filename,
								JSON.stringify(ocremix, null, '\t'),
								() => {
									entryDone();
								}
							)
						}
					);
				});
			}));

			yup(0);
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
