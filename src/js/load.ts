declare interface ImageSource {
	subpath:string,
	width:number,
	height:number,
	srcset:Array<{
		subpath:string,
		width:number,
	}>,
};

declare interface album {
	path: string;
	name: string;
	tracks: Array<track>;
	art: {
		covers: Array<ImageSource>,
		background: ImageSource,
	},
};

declare interface track {
	name: string;
	subpath: string;
	index: number;
};

(async () : Promise<void> => {
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

	const back:HTMLButtonElement|null = document.querySelector('body > header button#load-albums');

	if ( ! (back instanceof HTMLButtonElement)) {
		throw new Error('Could not find back button');
	}

	Object.entries(preloads).forEach((entry) => {
		if ( ! (entry[1] instanceof HTMLLinkElement)) {
			throw new Error('Could not find preloaded ' + entry[0]);
		}
	});

	(<HTMLLinkElement> preloads['style.css']).rel = 'stylesheet';

	const ipfs = ('Ipfs' in window) ? (<any> window).ipfs : await (
		new Promise((yup) => {
			const script = document.createElement('script');
			script.onload = () => {
				yup((<{create:() => object}> ((<any> window).Ipfs)).create());
			};
			script.src = (<HTMLLinkElement> preloads.ipfs).href

			document.head.appendChild(script);
		})
	);

	const ocremix = await fetch(
		(<HTMLLinkElement> preloads.ocremix).href
	).then((r) => {
		return r.json();
	});

	async function url(path:string) : Promise<string> {
		if ( ! (path in ocremix)) {
			throw new Error('path not in ipfs list: ' + path);
		}

		const cat = await ipfs.cat(ocremix[path]);

		const buffs = [];

		for await (const buff of cat) {
			buffs.push(buff);
		}

		return URL.createObjectURL(new Blob(buffs));
	};

	let current_album:album|undefined;

	const albums = document.createElement('main');
	albums.classList.add('albums');

	document.body.appendChild(albums);

	const view = document.createElement('main');
	const audio = document.createElement('audio');
	audio.controls = true;
	audio.src=  '';

	view.classList.add('view');

	const button_plays_what:WeakMap<HTMLButtonElement, string> = new WeakMap();

	back.addEventListener('click', () => {
		document.body.removeChild(view);
		document.body.appendChild(albums);
		back.disabled = true;
		current_album = undefined;
	});

	view.addEventListener('click', (e) => {
		if (
			(e.target instanceof HTMLButtonElement) &&
			button_plays_what.has(e.target)
		) {
			audio.pause();
			audio.src = button_plays_what.get(e.target) + '';
			audio.play();
		}
	});

	document.body.appendChild(audio);

	const zelda25:album = {
		path: '/Albums/25YEARLEGEND - A Legend of Zelda Indie Game Composer Tribute',
		name: '25YEARLEGEND - A Legend of Zelda Indie Game Composer Tribute',
		art: {
			covers: [
				{
					subpath: '/Artwork/Front (Legend) [Lisa Coffman].png',
					width: 700,
					height: 700,
					srcset: []
				},
				{
					subpath: '/Artwork/Front (Triforce OCR Logo Edit) [Paul Veer, Liontamer].png',
					width: 700,
					height: 700,
					srcset: []
				},
			],
			background: {
				subpath: '/Artwork/Front (Triforce) 500 [Paul Veer].png',
				width: 500,
				height: 500,
				srcset: [
					{
						subpath: '/Artwork/Front (Triforce) 700 [Paul Veer].png',
						width: 700,
					},
					{
						subpath: '/Artwork/Front (Triforce) 1000 [Paul Veer].png',
						width: 1000,
					},
				]
			}
		},
		tracks: [
			{
				subpath: '/MP3/01 Disasterpeace - Chamber of the Goddess [A Link to the Past].mp3',
				name: '01 Disasterpeace - Chamber of the Goddess [A Link to the Past]',
				index: 1,
			},
			{
				subpath: '/MP3/02 Rekcahdam - Gimme My Sword! [Link\'s Awakening - A Link to the Past].mp3',
				name: '02 Rekcahdam - Gimme My Sword! [Link\'s Awakening - A Link to the Past]',
				index: 2,
			},
			{
				subpath: '/MP3/03 Laura Shigihara - Fushigina Forest [A Link to the Past].mp3',
				name: '03 Laura Shigihara - Fushigina Forest [A Link to the Past]',
				index: 3,
			},
			{
				subpath: '/MP3/04 Joshua Morse - Link\'s Epoch [A Link to the Past].mp3',
				name: '04 Joshua Morse - Link\'s Epoch [A Link to the Past]',
				index: 4,
			},
			{
				subpath: '/MP3/05 Jeff Ball - Labyrinth of Dance Floors [A Link to the Past].mp3',
				name: '05 Jeff Ball - Labyrinth of Dance Floors [A Link to the Past]',
				index: 5,
			},
			{
				subpath: '/MP3/06 HyperDuck SoundWorks - Hoy, Small Fry! [Wind Waker - Ocarina of Time].mp3',
				name: '06 HyperDuck SoundWorks - Hoy, Small Fry! [Wind Waker - Ocarina of Time]',
				index: 6,
			},
			{
				subpath: '/MP3/07 Air & Sea - To Everything There Is a Temple of Seasons [Oracle of Seasons].mp3',
				name: '07 Air & Sea - To Everything There Is a Temple of Seasons [Oracle of Seasons]',
				index: 7,
			},
			{
				subpath: '/MP3/08 C418 - Skyward [Skyward Sword].mp3',
				name: '08 C418 - Skyward [Skyward Sword]',
				index: 8,
			},
			{
				subpath: '/MP3/09 Big Giant Circles feat. Jeff Ball - Thunderstruck [Ocarina of Time - Legend of Zelda].mp3',
				name: '09 Big Giant Circles feat. Jeff Ball - Thunderstruck [Ocarina of Time - Legend of Zelda]',
				index: 9,
			},
			{
				subpath: '/MP3/10 Josh Whelchel - Zelda\'s First Trip to the \'Village\' [OOT - LTTP - LOZ].mp3',
				name: '10 Josh Whelchel - Zelda\'s First Trip to the \'Village\' [OOT - LTTP - LOZ]',
				index: 10,
			},
			{
				subpath: '/MP3/11 MisfitChris - Village from Your Past [Ocarina of Time].mp3',
				name: '11 MisfitChris - Village from Your Past [Ocarina of Time]',
				index: 11,
			},
			{
				subpath: '/MP3/12 Mattias Haggstrom Gerdt - Hey, Listen [Ocarina of Time - Legend of Zelda].mp3',
				name: '12 Mattias Haggstrom Gerdt - Hey, Listen [Ocarina of Time - Legend of Zelda]',
				index: 12,
			},
			{
				subpath: '/MP3/13 Kozilek - Last Dance of the Giants [Majora\'s Mask].mp3',
				name: '13 Kozilek - Last Dance of the Giants [Majora\'s Mask]',
				index: 13,
			},
			{
				subpath: '/MP3/14 Gryzor87 - Ilia\'s Adagio Meets Dark March [Twilight Princess - A Link to the Past].mp3',
				name: '14 Gryzor87 - Ilia\'s Adagio Meets Dark March [Twilight Princess - A Link to the Past]',
				index: 14,
			},
			{
				subpath: '/MP3/15 Dong - Ballad of the Wind Fish (Kaze no Sakana Mix) [Link\'s Awakening].mp3',
				name: '15 Dong - Ballad of the Wind Fish (Kaze no Sakana Mix) [Link\'s Awakening]',
				index: 15,
			},
			{
				subpath: '/MP3/16 CTPLR - Lon Lon Ranch (CTPLR Mix) [Ocarina of Time].mp3',
				name: '16 CTPLR - Lon Lon Ranch (CTPLR Mix) [Ocarina of Time]',
				index: 16,
			},
			{
				subpath: '/MP3/17 SoulEye - Link\'s Final Battle [Link\'s Adventure].mp3',
				name: '17 SoulEye - Link\'s Final Battle [Link\'s Adventure]',
				index: 17,
			},
			{
				subpath: '/MP3/18 Matheus Manente - Zelda\'s Graceful Nightmare [OOT - MM - WW].mp3',
				name: '18 Matheus Manente - Zelda\'s Graceful Nightmare [OOT - MM - WW]',
				index: 18,
			},
		],
	};

	const sonic1:album = {
		path: '/Albums/Sonic the Hedgehog - The Sound of Speed',
		name: 'Sonic the Hedgehog - The Sound of Speed',
		art: {
			covers: [
				{
					subpath: '/Artwork/Front embed.png',
					width: 700,
					height: 700,
					srcset: [
						{
							subpath: '/Artwork/Front [Denny \'dish\' Iskandar, ProtoDome].png',
							width: 2000,
						},
					],
				},
				{
					subpath: '/Artwork/Back [ProtoDome].png',
					width: 2000,
					height: 2000,
					srcset: [],
				},
			],
			background: {
				subpath: '/Artwork/Website [OA].jpg',
				width: 1690,
				height: 1142,
				srcset: [],
			},
		},
		tracks: [
			{
				subpath: '/MP3/01 A, B, C, Start!.mp3',
				name: 'A, B, C, Start!',
				index: 1,
			},
			{
				subpath: '/MP3/02 The Sound of Speed.mp3',
				name: 'The Sound of Speed',
				index: 2,
			},
			{
				subpath: '/MP3/03 Shifting Islands.mp3',
				name: 'Shifting Islands',
				index: 3,
			},
			{
				subpath: '/MP3/04 Subsonic Sparkle.mp3',
				name: 'Subsonic Sparkle',
				index: 4,
			},
			{
				subpath: '/MP3/05 Spring Junkie.mp3',
				name: 'Spring Junkie',
				index: 5,
			},
			{
				subpath: '/MP3/06 Bubble Junkie.mp3',
				name: 'Bubble Junkie',
				index: 6,
			},
			{
				subpath: '/MP3/07 Fifty Rings to Ride.mp3',
				name: 'Fifty Rings to Ride',
				index: 7,
			},
			{
				subpath: '/MP3/08 Under Construction.mp3',
				name: 'Under Construction',
				index: 8,
			},
			{
				subpath: '/MP3/09 Hogtied.mp3',
				name: 'Hogtied',
				index: 9,
			},
			{
				subpath: '/MP3/10 Caos.mp3',
				name: 'Caos',
				index: 10,
			},
			{
				subpath: '/MP3/11 Clockwork Criminal.mp3',
				name: 'Clockwork Criminal',
				index: 11,
			},
			{
				subpath: '/MP3/12 Final Progression.mp3',
				name: 'Final Progression',
				index: 12,
			},
			{
				subpath: '/MP3/13 A Hog in His Prime.mp3',
				name: 'A Hog in His Prime',
				index: 13,
			},
		],
	};

	async function picture(
		album:album,
		art:ImageSource
	) : Promise<HTMLPictureElement> {
		const src = await url(album.path + art.subpath);
		const srcset = Promise.all(art.srcset.map(
			async (srcset) : Promise<string> => {
				const srcset_src = await url(album.path + srcset.subpath);

				return srcset_src + ' ' + srcset.width.toString(10);
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

	async function add_album(album:album) {
		const button = document.createElement('button');
		button.setAttribute('aria-label', `View &quot;${album.name}&quot;`);
		button.setAttribute('data-name', album.name);

		albums.appendChild(button);

		picture(album, album.art.covers[0]).then((append_picture) => {
			button.appendChild(append_picture);
		});

		button.addEventListener(
			'click',
			() => {
				current_album = album;
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

					url(album.path + track.subpath).then((url:string) => {
						button_plays_what.set(button, url);
						button.disabled = false;
					});
				});

				view.textContent = '';

				view.appendChild(covers);
				view.appendChild(tracks);

				picture(album, album.art.background).then((append_picture) => {
					if (current_album === album) {
						append_picture.classList.add('bg');
						view.appendChild(append_picture);
					}
				});

				Promise.all(album.art.covers.map(
					(cover) : Promise<HTMLPictureElement> => {
						return picture(album, cover);
					}
				)).then((pictures) => {
					if (current_album === album) {
						pictures.forEach((append_picture) => {
							const li = document.createElement('li');
							li.appendChild(append_picture);

							covers.appendChild(li);
						});
					}
				});

				document.body.appendChild(view);
				(<HTMLButtonElement> back).disabled = false;
			}
		);
	}

	add_album(zelda25);
	add_album(sonic1);
})();
