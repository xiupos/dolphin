import * as cluster from 'cluster';
import { initDb } from '../db/postgre';

/**
 * Init worker process
 */
export async function workerMain() {
	const workerType = process.env.type;

	await initDb();

	// start server
	if (workerType === 'main') {
		await require('../server').default();
	}

	// start job queue
	if (workerType === 'queue') {
		require('../queue').default();
	}

	const x = () => {
		console.log(`MEM ${workerType}: ${JSON.stringify(process.memoryUsage())}`);
		if (typeof global.gc === 'function') {
			console.log('GC');
		} else {
			console.log('no GC');
		}
	}
	setInterval(x, 1 * 60 * 1000);

	if (cluster.isWorker) {
		// Send a 'ready' message to parent process
		process.send!('ready');
	}
}
