import {
	ImageSource,
	Album,
	Track,
	SupportedExtensionLower,
	SupportedExtensionUpperOrLower,
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
		{GetIpfsInstance},
	] = await Promise.all([
		import('../lit-html/lit-html.js'),
		import('../lit-html/directives/async-append.js'),
		import('../lit-html/directives/async-replace.js'),
		import('./ipfs.js'),
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
	const blobs: {[key: string]: Promise<Blob>} = {};
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

	const ocremix = await fetch(
		(preloads.ocremix as HTMLLinkElement).href
	).then((r) => {
		return r.json();
	});

	function pathCID(path: string): string
	{
		if ( ! (path in ocremix)) {
			throw new Error(
				'album + track combo not found in ocremix payload!'
			);
		}

		return ocremix[path];
	}

	function albumTrackCID(album: Album, track: Track): string
	{
		return pathCID(album.path + track.subpath);
	}

	function mimeType(ext: SupportedExtensionLower): string
	{
		switch (ext) {
			case 'mp3':
				return 'audio/mpeg';
			case 'png':
				return 'image/png';
			case 'jpeg':
			case 'jpg':
				return 'image/jpeg';
		}
	}

	async function fetchBlobViaCacheOrIpfs(
		path: string,
		skipCache = false
	): Promise<Blob> {
		const match = /.(mp3|png|jpe?g)$/i.exec(path);
		const cid = pathCID(path);
		const buffs: Array<Uint8Array> = [];

		if ( ! match) {
			throw new Error('Unsupported file type requested!');
		}

		const [, EXT] = match;

		const ext = (
			(
				EXT as SupportedExtensionUpperOrLower
			).toLowerCase() as SupportedExtensionLower
		);

		if ('caches' in window && ! skipCache) {
			const cache = await caches.open('ocremix-ipfs-by-cid');
			const url = '/ipfs/' + ocremix[path];
			const faux = new Request(url);
			const maybe: Response|undefined = await cache.match(faux);

			const cacheBlob = maybe
				? await maybe.blob()
				: await fetchBlobViaCacheOrIpfs(path, true)

			if ( ! maybe) {
				await cache.put(url, new Response(cacheBlob));
			}

			return cacheBlob;
		}

		for await (const buff of (await GetIpfsInstance()).cat(cid)) {
			buffs.push(buff);
		}

		return new Blob(buffs, {type: mimeType(ext)});
	}

	async function blob(path: string): Promise<Blob> {
		const cid = pathCID(path);

		if ( ! (cid in blobs)) {
			blobs[cid] = new Promise((yup, nope) => {
				try {
					(async (): Promise<Blob> => {
						return await fetchBlobViaCacheOrIpfs(path);
					})().then(yup);
				} catch (err) {
					nope(err);
				}
			});
		}

		return await blobs[cid];
	}

	async function url(path: string): Promise<string> {
		return URL.createObjectURL(await blob(path));
	}

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
		const src = await url(album.path + art.subpath);
		const srcset = await Promise.all(art.srcset.map(
			async (srcset): Promise<string> => {
				const srcsetSrc = await url(album.path + srcset.subpath);

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
			<ol class="tracks">${album.tracks.map((track) => {
				const cid = albumTrackCID(album, track);
				const path = album.path + track.subpath;
				let trackUrl: string|undefined;

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

								button.disabled = true;
								button.textContent = '⏳';
								trackMostRecentlyAttemptedToPlay = cid;

								if ( ! trackUrl) {
									trackUrl = await url(path);
								}

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
