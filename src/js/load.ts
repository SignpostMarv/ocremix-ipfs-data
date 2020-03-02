import {
	ImageSource,
	Album,
	IpfsInstance,
} from '../module';

(async (): Promise<void> => {
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

	const ipfs: IpfsInstance = ('ipfs' in window) ? (window as (Window & typeof globalThis & {ipfs: IpfsInstance})).ipfs : await (
		new Promise((yup) => {
			const script = document.createElement('script');
			script.onload = (): void => {
				yup((((window as (Window & typeof globalThis & {Ipfs: object})).Ipfs) as {create: () => IpfsInstance}).create());
			};
			script.src = (preloads.ipfs as HTMLLinkElement).href

			document.head.appendChild(script);
		})
	);

	const ocremix = await fetch(
		(preloads.ocremix as HTMLLinkElement).href
	).then((r) => {
		return r.json();
	});

	async function url(path: string): Promise<string> {
		if ( ! (path in ocremix)) {
			throw new Error('path not in ipfs list: ' + path);
		}

		const cat = await ipfs.cat(ocremix[path]);

		const buffs = [];

		for await (const buff of cat) {
			buffs.push(buff);
		}

		return URL.createObjectURL(new Blob(buffs));
	}

	let currentAlbum: Album|undefined;

	const albums = document.createElement('main');
	albums.classList.add('albums');

	document.body.appendChild(albums);

	const view = document.createElement('main');
	const audio = document.createElement('audio');
	audio.controls = true;
	audio.src=  '';

	view.classList.add('view');

	const buttonPlaysWhat: WeakMap<HTMLButtonElement, string> = new WeakMap();

	back.addEventListener('click', () => {
		document.body.removeChild(view);
		document.body.appendChild(albums);
		back.disabled = true;
		currentAlbum = undefined;
	});

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

	document.body.appendChild(audio);

	async function picture(
		album: Album,
		art: ImageSource
	): Promise<HTMLPictureElement> {
		const src = await url(album.path + art.subpath);
		const srcset = Promise.all(art.srcset.map(
			async (srcset): Promise<string> => {
				const srcsetSrc = await url(album.path + srcset.subpath);

				return srcsetSrc + ' ' + srcset.width.toString(10);
			}
		));
		(await srcset).push(src + ' ' + art.width.toString(10));

		const picture = document.createElement('picture');
		const img = new Image();
		img.src = src;
		img.width = art.width;
		img.height = art.height;
		img.srcset = (await srcset).join(', ');

		picture.appendChild(img);

		return picture;
	}

	async function AddAlbum(album: Album): Promise<void> {
		const button = document.createElement('button');
		button.setAttribute('aria-label', `View &quot;${album.name}&quot;`);
		button.setAttribute('data-name', album.name);

		albums.appendChild(button);

		picture(album, album.art.covers[0]).then((appendPicture) => {
			button.appendChild(appendPicture);
		});

		button.addEventListener(
			'click',
			() => {
				currentAlbum = album;
				document.body.removeChild(albums);

				const covers = document.createElement('ol');
				const tracks = document.createElement('ol');

				covers.classList.add('covers');
				tracks.classList.add('tracks');

				album.tracks.forEach((track) => {
					const li = document.createElement('li');
					const button = document.createElement('button');

					button.appendChild(document.createTextNode('▶'));
					button.setAttribute(
						'aria-label',
						`Play ${track.name}`
					);
					button.disabled = true;

					li.appendChild(button);
					li.appendChild(document.createTextNode(track.name));

					tracks.appendChild(li);

					url(album.path + track.subpath).then((url: string) => {
						buttonPlaysWhat.set(button, url);
						button.disabled = false;
					});
				});

				view.textContent = '';

				view.appendChild(covers);
				view.appendChild(tracks);

				picture(album, album.art.background).then((appendPicture) => {
					if (currentAlbum === album) {
						appendPicture.classList.add('bg');
						view.appendChild(appendPicture);
					}
				});

				Promise.all(album.art.covers.map(
					(cover): Promise<HTMLPictureElement> => {
						return picture(album, cover);
					}
				)).then((pictures) => {
					if (currentAlbum === album) {
						pictures.forEach((appendPicture) => {
							const li = document.createElement('li');
							li.appendChild(appendPicture);

							covers.appendChild(li);
						});
					}
				});

				document.body.appendChild(view);
				(back as HTMLButtonElement).disabled = false;
			}
		);
	}

	[
		'../data/albums/OCRA-0025.js',
		'../data/albums/OCRA-0029.js',
	].forEach((albumModuleSrc) => {
		import(albumModuleSrc).then((album) => {
			AddAlbum(album.default);
		})
	});
})();
