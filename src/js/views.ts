/*
import {
	Album
} from '../module';
*/

const importedView: {
	[regexString: string]: Promise<HTMLElement|undefined>;
} = {};
const albumHashRegex = /^#album\/(OCRA\d{4})$/;

function buildView(
	entry: [string, string]
): (hash: string) => Promise<HTMLElement|undefined> {
	const [regexString, viewModule] = entry;

	const regex = new RegExp(regexString);

	return async (hash: string): Promise<HTMLElement|undefined> => {
		if ( ! regex.test(hash)) {
			return;
		} else if ( ! (regexString in importedView)) {
			importedView[regexString] = (await import(viewModule)).default;
		}

		return importedView[regexString];
	};
}

const views = Object.entries({
	'^#?$': './views/albums.js',
}).map(buildView);
/*
let currentAlbum: Album|undefined;
*/

views.push(async (hash: string): Promise<HTMLElement|undefined> => {
	if ( ! /^#app$/.test(hash)) {
		return;
	}

	const { updateAppInfo } = await import('./views/app-info.js');

	return await updateAppInfo();
});
views.push(async (hash: string): Promise<HTMLElement|undefined> => {
	const maybe = albumHashRegex.exec(hash);
	if ( ! maybe) {
		return;
	}

	const { albumView } = await import('./views/album.js');

	const result = await albumView(maybe[1]);

	if ( ! result) {
		return;
	}

	const [
		view,
		/*
		album,
		*/
	] = result;

	if (location.hash === hash) {
		/*
		currentAlbum = album;
		*/

		return view;
	} else {
		console.log(
			'hash changed while album data was being loaded'
		);
	}

	return;
});
views.push(buildView(['.+', './views/not-found.js']));

export async function handleView(hash: string): Promise<HTMLElement> {
	for await (const maybe of views) {
		const result = await maybe(hash);

		if (result) {
			return result;
		}
	}

	throw new Error('Could not resolve hash to view');
}
