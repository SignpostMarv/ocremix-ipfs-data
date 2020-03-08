export async function* yieldStorageEstimate(
	estimate: number
): AsyncGenerator<string> {
	yield 'calculating...';

	let divisor = 0;

	const labels = [
		'b',
		'kb',
		'mb',
		'gb',
		'tb',
	];

	const estimateDisplay = (): string => {
		return `${
			(estimate / (1024 ** divisor)).toFixed(2)
		}${
			labels[divisor]
		}`;
	}

	while (
		(estimate / (1024 ** divisor)) > 1 &&
		divisor < labels.length
	) {
		yield estimateDisplay();

		++divisor;
	}
}
