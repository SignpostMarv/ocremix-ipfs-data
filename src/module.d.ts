export interface SrcsetSource {
	subpath: string;
	width: number;
}

export interface ImageSource extends SrcsetSource {
	height: number;
	srcset: Array<SrcsetSource>;
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
