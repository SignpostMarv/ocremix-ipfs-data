/*
import {
	Album
} from '../module';
*/

import {
	updateTitleSuffix
} from './utilities/elements.js';

const albumHashRegex = /^#album\/(OCRA\d{4})$/;

const views: Array<(hash: string) => Promise<HTMLElement|undefined>> = [];
/*
let currentAlbum: Album|undefined;
*/

views.push(async (hash: string): Promise<HTMLElement|undefined> => {
	if ( ! /^#?$/.test(hash)) {
		return;
	}

	const { albumsView } = await import('./views/albums.js');

	return await albumsView();
});

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
		album,
	] = result;

	if (location.hash === hash) {
		/*
		currentAlbum = album;
		*/

		updateTitleSuffix(album.name);

		return view;
	} else {
		console.log(
			'hash changed while album data was being loaded'
		);
	}

	return;
});
views.push(async (): Promise<HTMLElement> => {
	const { notFound } = await import('./views/not-found.js');

	return await notFound();
});

export async function handleView(hash: string): Promise<HTMLElement> {
	for await (const maybe of views) {
		const result = await maybe(hash);

		if (result) {
			return result;
		}
	}

	throw new Error('Could not resolve hash to view');
}
