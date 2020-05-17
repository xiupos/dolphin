import * as cluster from 'cluster';
import { initDb } from '../db/postgre';

/**
 * Init worker process
 */
export async function workerMain() {
	await initDb();

	// start server
	await require('../server').default();

	// start job queue
	require('../queue').default();

	const x = () => {
		console.log(`MEM: ${JSON.stringify(process.memoryUsage())}`);
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
