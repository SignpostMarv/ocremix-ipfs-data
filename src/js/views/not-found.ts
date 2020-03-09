import {
	render,
	html,
} from '../../lit-html/lit-html.js';

const main = document.createElement('main');

render(
	html`
		<h2>Not Found</h2>
		<p>Nothing to see here.</p>
	`,
	main
);

export default main;
