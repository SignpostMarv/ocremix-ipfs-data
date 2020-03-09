import {
	Album,
	ImageSource,
} from '../../module';
import {
	TemplateResult,
	html,
} from '../../lit-html/lit-html.js';
import {
	urlForThing,
} from '../data.js';

export async function picture(
	album: Album,
	art: ImageSource,
	className = ''
): Promise<HTMLPictureElement> {
	const src = await urlForThing(art, album.path + art.subpath);
	const srcset = await Promise.all(art.srcset.map(
		async (srcset): Promise<string> => {
			const srcsetSrc = await urlForThing(
				srcset,
				album.path + srcset.subpath
			);

			return srcsetSrc + ' ' + srcset.width.toString(10) + 'w';
		}
	));
	const picture = document.createElement('picture');
	const img = new Image();

	if (srcset.length > 0) {
		srcset.push(src + ' ' + art.width.toString(10) + 'w');
	}

	img.src = src;
	img.width = art.width;
	img.height = art.height;
	if (srcset.length > 0) {
		img.srcset = srcset.join(', ');
	}

	picture.appendChild(img);

	picture.className = className;

	return picture;
}

export async function* yieldPlaceholderThenPicture(
	placeholder: string,
	album: Album,
	art: ImageSource
): AsyncGenerator<string|HTMLPictureElement> {
	yield placeholder;

	yield await picture(album, art);
}

export async function* yieldAlbumCovers(
	album: Album
): AsyncGenerator<TemplateResult> {
	for await (const appendPicture of album.art.covers.map(
		(cover): Promise<HTMLPictureElement> => {
			return picture(album, cover);
		}
	)) {
		yield html`<li>${appendPicture}</li>`;
	}
}

export async function* yieldAlbumBackground(
	album: Album
): AsyncGenerator<HTMLPictureElement> {
	yield await picture(album, album.art.background, 'bg');
}
