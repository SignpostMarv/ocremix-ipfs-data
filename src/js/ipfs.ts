import {
	IpfsInstance,
	IpfsGlobal,
} from '../module';

let _ipfs: Promise<IpfsInstance>|undefined;

export function GetIpfsInstance(): Promise<IpfsInstance> {
	if (_ipfs) {
		return _ipfs;
	}

	try {
		if ('ipfs' in window) {
			throw new Error(
				'https://github.com/ipfs-shipyard/ipfs-companion/issues/852'
			);
			/*
			_ipfs = (
				window as (
					Window &
					typeof globalThis &
					{ipfs: {enable: () => Promise<IpfsInstance>}}
				)
			).ipfs.enable();
			*/
		}

		throw new Error('window.ipfs not available');
	} catch (err) {
		console.error(err);

		_ipfs = new Promise((yup): void => {
			(async (src): Promise<void> => {
				yup (
					await ((await import(src)).Ipfs as IpfsGlobal).create()
				);
			})('../ipfs/index.module.min.js');
		});
	}

	return _ipfs;
}

export default GetIpfsInstance;
