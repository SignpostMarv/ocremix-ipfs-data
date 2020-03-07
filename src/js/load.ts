import {
	ImageSource,
	Album,
	Track,
} from '../module';
import { TemplateResult } from '../lit-html/lit-html';

(async (): Promise<void> => {
	let currentAlbum: Album|undefined;
	let currentTrack: Track|undefined;
	let trackMostRecentlyAttemptedToPlay: string|undefined;

	const [
		{html, render},
		{asyncAppend},
		{asyncReplace},
		{
			albumTrackCID,
			urlForThing,
		},
	] = await Promise.all([
		import('../lit-html/lit-html.js'),
		import('../lit-html/directives/async-append.js'),
		import('../lit-html/directives/async-replace.js'),
		import('./data.js'),
	]);

	const preloads = {
		'style.css': document.head.querySelector(
			'link[rel="preload"][as="style"][href$="/css/style.css"]'
		),
		'ipfs': document.head.querySelector(
			'link[rel="modulepreload"][href$="/ipfs/index.module.min.js"]'
		),
		'ocremix' : document.head.querySelector(
			'link[rel="preload"][as="fetch"][href$="/data/ocremix-cids.json"]'
		),
	};

	const back: HTMLButtonElement|null = document.querySelector(
		'body > header button#load-albums'
	);
	const albums = document.createElement('main');
	const views: WeakMap<Album, HTMLElement> = new WeakMap();
	const audio = ((): HTMLAudioElement => {
		const audio = document.createElement('audio');

		audio.controls = true;
		audio.src=  '';

		audio.addEventListener('ended', () => {
			currentTrack = undefined;
		});

		return audio;
	})();

	if ( ! (back instanceof HTMLButtonElement)) {
		throw new Error('Could not find back button');
	}

	Object.entries(preloads).forEach((entry) => {
		if ( ! (entry[1] instanceof HTMLLinkElement)) {
			throw new Error('Could not find preloaded ' + entry[0]);
		}
	});

	(preloads['style.css'] as HTMLLinkElement).rel = 'stylesheet';

	function play(src: string): void {
		console.log(src);
		if (audio.src !== src) {
			audio.pause();
			audio.src = src;
		}
		audio.play();
	}

	albums.classList.add('albums');

	document.body.appendChild(albums);

	back.addEventListener('click', () => {
		if (currentAlbum) {
			document.body.removeChild(views.get(currentAlbum) as HTMLElement);
		}
		document.body.appendChild(albums);
		back.disabled = true;
		currentAlbum = undefined;
	});

	document.body.appendChild(audio);

	async function picture(
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

	async function* yieldPlaceholderThenPicture(
		placeholder: string,
		album: Album,
		art: ImageSource
	): AsyncGenerator<string|HTMLPictureElement> {
		yield placeholder;

		yield await picture(album, art);
	}

	async function* yieldAlbumCovers(
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

	async function* yieldAlbumBackground(
		album: Album
	): AsyncGenerator<HTMLPictureElement> {
		yield await picture(album, album.art.background, 'bg');
	}

	function AlbumView(album: Album): TemplateResult {
		return html`
			<ol class="covers">${asyncAppend(yieldAlbumCovers(album))}</ol>
			<dl class="discs">${Object.entries(album.discs).map((disc) => {
				const [discName, tracks] = disc;

				return html`
					<dt>${discName}</dt>
					<dd>
						<ol class="tracks">${tracks.map((track) => {
				const path = album.path + track.subpath;

				return html`
					<li>
						<button
							type="button"
							aria-label="Play or Pause ${track.name}"
							@click=${async (e: Event): Promise<void> => {
								const button = e.target as HTMLButtonElement;

								if (currentTrack === track) {
									audio.pause();
									button.textContent = '⏯';
									currentTrack = undefined;

									return;
								}

								const cid = await albumTrackCID(album, track);

								button.disabled = true;
								button.textContent = '⏳';
								trackMostRecentlyAttemptedToPlay = cid;

								const trackUrl = await urlForThing(
									track,
									path
								);

								button.disabled = false;
								button.textContent = '⏯';

								if (cid === trackMostRecentlyAttemptedToPlay) {
									currentTrack = track;
									play(trackUrl);
								}
							}}
						>⏯</button>
						${track.name}
					</li>
				`;
						})}</ol>
					</dd>
				`;
			})}</dl>
			${asyncAppend(yieldAlbumBackground(album))}
		`;
	}

	async function AddAlbum(album: Album): Promise<TemplateResult> {
		const view = document.createElement('main');
		const button = html`<button
			aria-label="View &quot;${album.name}&quot;"
			data-name="${album.name}"
			@click=${(): void => {
				if (currentAlbum) {
					document.body.removeChild(
						views.get(currentAlbum) as HTMLElement
					);
				}
				currentAlbum = album;
				document.body.removeChild(albums);
				render(AlbumView(album), view);
				document.body.appendChild(view);
				(back as HTMLButtonElement).disabled = false;
			}}
		>${asyncReplace(yieldPlaceholderThenPicture(
			'Loading...',
			album,
			album.art.covers[0]
		))}</button>`;

		views.set(album, view);
		view.classList.add('view');

		return button;
	}

	async function* renderAlbums(): AsyncGenerator<TemplateResult> {
		for (const albumModuleSrc of [
			'../data/albums/OCRA-0025.js',
			'../data/albums/OCRA-0029.js',
		]) {
			yield await import(albumModuleSrc).then((album) => {
				return AddAlbum(album.default);
			})
		}
	}

	render(html`${asyncAppend(renderAlbums())}`, albums);
})();
