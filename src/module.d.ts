export interface SrcsetSource {
	subpath: string;
	width: number;
}

export interface ImageSource extends SrcsetSource {
	height: number;
	srcset: Array<SrcsetSource>;
}

export interface Discs {[name: string]: Array<Track>}

export interface Album {
	id: string;
	path: string;
	name: string;
	discs: Discs;
	credits: {
		directors: Array<Credit>;
		arrangers: Array<Credit>;
		composers: Array<Credit>;
		artwork: Array<Credit>;
	};
}

export interface AlbumWithArt extends Album {
	art: {
		covers: Array<ImageSource>;
		background: ImageSource;
	};
}

export interface Track {
	name: string;
	subpath: string;
	index: number;
	credits: Array<Credit|string>;
}

export interface BrokenTrack extends Track {
	fixAvailable: boolean;
}

export interface Credit {
	name: string | {[locale: string]: string};
	url: string|undefined;
}

export interface GroupCredit extends Credit {
	members: Array<Credit|string>;
}
