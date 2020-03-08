import {
	Album,
	ImageSource,
} from '../../module';
import {
	TemplateResult,
	html,
} from '../../lit-html/lit-html.js';
import {
	asyncReplace,
} from '../../lit-html/directives/async-replace.js';
import {
	urlForThing,
	ocremixCID,
} from '../data.js';
import {
	yieldFilesProgress,
	GetAllFactory,
} from './elements/bulk-album-actions.js';

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

export async function* yieldBulkAlbumAction(
	appInfo: HTMLElement,
	id: string,
	getAlbum: () => Promise<Album>
): AsyncGenerator<string|TemplateResult> {
	yield `Loading ${id}`;

	const album = await getAlbum();
	const pathsForApp: Array<string> = [];
	const imageSourcesForAlubm = album.art.covers;

	const filesInIpfs = Object.fromEntries(
		Object.entries(await ocremixCID).filter(
			(entry) => {
				return entry[0].startsWith(album.path);
			}
		)
	);

	imageSourcesForAlubm.push(album.art.background);

	Object.values(album.discs).forEach((tracks) => {
		tracks.forEach((track) => {
			pathsForApp.push(album.path + track.subpath);
		});
	});

	imageSourcesForAlubm.forEach((source) => {
		pathsForApp.push(album.path + source.subpath);

		source.srcset.forEach((srcset) => {
			pathsForApp.push(album.path + srcset.subpath);
		});
	});

	const filesForApp = Object.fromEntries(
		Object.entries(filesInIpfs).filter((entry) => {
			return pathsForApp.includes(entry[0]);
		})
	);

	yield html`
		${asyncReplace(
			yieldFilesProgress(
				id,
				appInfo,
				filesForApp,
				'for-app',
				'Files cached for use in app'
			)
		)}
		${asyncReplace(
			yieldFilesProgress(
				id,
				appInfo,
				filesInIpfs,
				'for-ipfs',
				'Files cached from IPFS source'
			)
		)}
		${asyncReplace(yieldPlaceholderThenPicture(
			'Loading...',
			album,
			album.art.covers[0]
		))}
		<div>
			<button
				aria-label="Clear all cached files for ${album.name}"
				data-action="remove"
				type="button"
				disabled
				@click=${async (): Promise<void> => {
					alert('not yet implemented!');
				}}
			>🗑</button>
			<button
				aria-label="Get all needed files for ${album.name}"
				data-action="get-all"
				type="button"
				disabled
				@click=${GetAllFactory(appInfo, filesForApp, filesInIpfs, id)}
			>🔽</button>
		</div>
	`;
}
