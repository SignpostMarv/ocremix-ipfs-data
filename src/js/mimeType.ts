import {
	SupportedExtensionLower,
} from '../module';

export function mimeType(ext: SupportedExtensionLower): string
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
