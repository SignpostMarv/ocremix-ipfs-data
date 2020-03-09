import {
	render,
	html,
} from '../../lit-html/lit-html.js';
import {
	updateTitleSuffix,
} from '../utilities/elements.js';

const main = document.createElement('main');

render(
	html`
		<h2>Not Found</h2>
		<p>Nothing to see here.</p>
	`,
	main
);

export async function notFound(): Promise<HTMLElement> {
	updateTitleSuffix('Not Found');

	return main;
}
