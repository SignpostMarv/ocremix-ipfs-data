import {
	ImageSource,
	Album,
	Track,
	IpfsInstance,
	SupportedExtensionLower,
	SupportedExtensionUpperOrLower,
} from '../module';
import { TemplateResult } from '../lit-html/lit-html';

(async (): Promise<void> => {
	const {html, render} = await import('../lit-html/lit-html.js');
	const {asyncAppend} = await import('../lit-html/directives/async-append.js');
	const {asyncReplace} = await import('../lit-html/directives/async-replace.js');
	const buttonPlaysWhat: WeakMap<HTMLButtonElement, string> = new WeakMap();

	const preloads = {
		'style.css': document.head.querySelector(
			'link[rel="preload"][as="style"][href$="/css/style.css"]'
		),
		'ipfs': document.head.querySelector(
			'link[rel="preload"][as="script"][href$="/ipfs/index.min.js"]'
		),
		'ocremix' : document.head.querySelector(
			'link[rel="preload"][as="fetch"][href$="/data/ocremix-cids.json"]'
		),
	};

	const back: HTMLButtonElement|null = document.querySelector('body > header button#load-albums');

	if ( ! (back instanceof HTMLButtonElement)) {
		throw new Error('Could not find back button');
	}

	Object.entries(preloads).forEach((entry) => {
		if ( ! (entry[1] instanceof HTMLLinkElement)) {
			throw new Error('Could not find preloaded ' + entry[0]);
		}
	});

	(preloads['style.css'] as HTMLLinkElement).rel = 'stylesheet';

	let _ipfs: Promise<IpfsInstance>|undefined;

	function GetIpfsInstance(): Promise<IpfsInstance> {
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

			_ipfs = new Promise((yup) => {
				const script = document.createElement('script');
				script.onload = (): void => {
					yup(((window as (
						Window &
						typeof globalThis &
						{Ipfs: {create: () => IpfsInstance}}
					)).Ipfs).create());
				};
				script.src = (preloads.ipfs as HTMLLinkElement).href

				document.head.appendChild(script);
			});
		}

		return _ipfs;
	}

	const ocremix = await fetch(
		(preloads.ocremix as HTMLLinkElement).href
	).then((r) => {
		return r.json();
	});

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

	async function blob(path: string, skipCache = false): Promise<Blob> {
		if ( ! (path in ocremix)) {
			throw new Error('path not in ipfs list: ' + path);
		}

		const match = /.(mp3|png|jpe?g)$/i.exec(path);

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

			console.log(maybe);

			if ( ! maybe) {
				const cacheBlob = await blob(path, true);

				await cache.put(url, new Response(cacheBlob));

				return cacheBlob;
			} else {
				return await maybe.blob();
			}
		}

		const cat = await (await GetIpfsInstance()).cat(ocremix[path]);

		const buffs = [];

		for await (const buff of cat) {
			buffs.push(buff);
		}

		return new Blob(buffs, {type: mimeType(ext)});
	}

	async function url(path: string): Promise<string> {
		return URL.createObjectURL(await blob(path));
	}

	let currentAlbum: Album|undefined;

	console.log(currentAlbum);

	const albums = document.createElement('main');
	albums.classList.add('albums');

	document.body.appendChild(albums);

	const views: WeakMap<Album, HTMLElement> = new WeakMap();
	const audio = document.createElement('audio');
	audio.controls = true;
	audio.src=  '';

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

		if (srcset.length > 0) {
			srcset.push(src + ' ' + art.width.toString(10) + 'w');
		}

		const picture = document.createElement('picture');
		const img = new Image();
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

	async function* YieldTrackPlayButton(
		album: Album,
		track: Track
	): AsyncGenerator<HTMLButtonElement> {
		const div = document.createElement('div');

		const trackUrl = await url(
			album.path +
			track.subpath
		);

		render(
			html`
				<button
					aria-label="Play ${track.name}"
					album=${album} track=${track}
				>▶</button>
			`,
			div
		);

		const button = div.querySelector(
			'button'
		) as HTMLButtonElement;

		buttonPlaysWhat.set(button, trackUrl);

		yield button;
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
				return html`
					<li>
						${asyncAppend(YieldTrackPlayButton(album, track))}
						<button
							disabled
						>▶</button>
						${track.name}
					</li>
				`;
			})}</ol>
			${asyncAppend(yieldAlbumBackground(album))}
		`;
	}

	async function AddAlbum(album: Album): Promise<TemplateResult> {
		const view = document.createElement('main');

		views.set(album, view);
		view.classList.add('view');
		view.addEventListener('click', (e) => {
			if (
				(e.target instanceof HTMLButtonElement) &&
				buttonPlaysWhat.has(e.target)
			) {
				audio.pause();
				audio.src = buttonPlaysWhat.get(e.target) + '';
				audio.play();
			}
		});

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
