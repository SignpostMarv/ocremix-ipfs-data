import {
	ImageSource,
	Album,
	Track,
} from '../module';
import {
	TemplateResult,
	html,
	render,
} from '../lit-html/lit-html.js';
import {asyncAppend} from '../lit-html/directives/async-append.js';
import {asyncReplace} from '../lit-html/directives/async-replace.js';
import {
	albumTrackCID,
	urlForThing,
} from './data.js';
import {Albums} from '../data/albums.js';

(async (): Promise<void> => {
	let currentAlbum: Album|undefined;
	let currentTrack: Track|undefined;
	let trackMostRecentlyAttemptedToPlay: string|undefined;

	const preloads = {
		'style.css': document.head.querySelector(
			'link[rel="preload"][as="style"][href$="/css/style.css"]'
		),
	};

	const back: HTMLAnchorElement|null = document.querySelector(
		'body > header a#load-albums'
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

	if ( ! (back instanceof HTMLAnchorElement)) {
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

	async function AddAlbum(album: Album, _albumId: string): Promise<TemplateResult> {
		const button = html`<a
			href="#album/${_albumId}"
			aria-label="View &quot;${album.name}&quot;"
		>${asyncReplace(yieldPlaceholderThenPicture(
			'Loading...',
			album,
			album.art.covers[0]
		))}</a>`;

		return button;
	}

	async function* renderAlbums(): AsyncGenerator<TemplateResult> {
		for (const [albumId, albumGetter] of Object.entries(Albums)) {
			yield await albumGetter().then((album) => {
				return AddAlbum(album, albumId);
			})
		}
	}

	render(html`${asyncAppend(renderAlbums())}`, albums);

	const albumHashRegex = /^#album\/(OCRA\d{4})$/;

	function handleHash(hash: string): void {
		if ('#' === hash || '' === hash) {
			for (const toRemove of document.querySelectorAll('body > main')) {
				document.body.removeChild(toRemove);
			}
			document.body.appendChild(albums);
			(back as HTMLAnchorElement).classList.add('disabled');
		} else {
			document.body.removeChild(albums);
			(back as HTMLAnchorElement).classList.remove('disabled');

			const maybe = albumHashRegex.exec(hash);

			if (maybe && maybe[1] in Albums) {
				Albums[maybe[1]]().then((album) => {
					if ( ! views.has(album)) {
						const view = document.createElement('main');
						render(AlbumView(album), view);
						view.classList.add('view');
						views.set(album, view);
					}

					if (location.hash === hash) {
						currentAlbum = album;
						document.body.appendChild(
							views.get(album) as HTMLElement
						);
					} else {
						console.log(
							'hash changed while album data was being loaded'
						);
					}
				});
			} else {
				console.warn('unsupported hash specified', hash);
			}
		}
	}

	addEventListener('hashchange', () => {
		handleHash(location.hash);
	});

	handleHash(location.hash);

	console.info(currentAlbum);
})();
