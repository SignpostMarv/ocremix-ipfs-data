import { handleView } from './views.js';

(async (): Promise<void> => {
	[...document.head.querySelectorAll(
		'link[rel="preload"][as="style"][href*="/css/"][href$=".css"]'
	)].forEach((preloadStylesheet) => {
		(preloadStylesheet as HTMLLinkElement).rel = 'stylesheet';
	})

	const back: HTMLAnchorElement|null = document.querySelector(
		'body > header a#load-albums'
	);

	if ( ! (back instanceof HTMLAnchorElement)) {
		throw new Error('Could not find back button');
	}

	function swapMain(useThisInstead: HTMLElement, allowBack = true): void {
		for (const toRemove of document.querySelectorAll('body > main')) {
			if (toRemove !== useThisInstead) {
				document.body.removeChild(toRemove);
			}
		}

		document.body.appendChild(useThisInstead);

		if (allowBack) {
			(back as HTMLAnchorElement).classList.remove('disabled');
		} else {
			(back as HTMLAnchorElement).classList.add('disabled');
		}
	}

	async function handleHash(hash: string): Promise<void> {
		swapMain(
			await handleView(hash),
			('#' !== hash && '' !== hash)
		);
	}

	addEventListener('hashchange', () => {
		handleHash(location.hash);
	});

	handleHash(location.hash);
})();
