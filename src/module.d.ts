export interface ImageSource {
	subpath: string;
	width: number;
	height: number;
	srcset: Array<{
		subpath: string;
		width: number;
	}>;
}

export interface Album {
	path: string;
	name: string;
	tracks: Array<Track>;
	art: {
		covers: Array<ImageSource>;
		background: ImageSource;
	};
}

export interface Track {
	name: string;
	subpath: string;
	index: number;
}

export interface IpfsGlobal {
	create: () => Promise<IpfsInstance>;
}

export interface IpfsInstance {
	cat: (cid: string) => AsyncGenerator<Uint8Array>;
}

export type SupportedExtensionLower = (
	'mp3'|
	'png'|
	'jpg'|
	'jpeg'
);

export type SupportedExtensionUpperOrLower = (
	SupportedExtensionLower|
	'MP3'|
	'PNG'|
	'JPG'|
	'JPEG'
);
