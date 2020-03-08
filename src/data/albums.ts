import {
	Album,
} from '../module';

export const Albums: {[id: string]: () => Promise<Album>} = {
	OCRA0006: async (): Promise<Album> => {
		const {OCRA0006} = await import('./albums/OCRA-0006.js');

		return OCRA0006;
	},
	OCRA0025: async (): Promise<Album> => {
		const {OCRA0025} = await import('./albums/OCRA-0025.js');

		return OCRA0025;
	},
	OCRA0029: async (): Promise<Album> => {
		const {OCRA0029} = await import('./albums/OCRA-0029.js');

		return OCRA0029;
	},
};
