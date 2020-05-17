import * as cluster from 'cluster';
import { initDb } from '../db/postgre';

/**
 * Init worker process
 */
export async function workerMain() {
	const workerType = process.env.WORKER_TYPE;
	console.log(workerType);

	await initDb();

	if (workerType === 'server') {
		await require('../server').default();
	} else if (workerType === 'queue') {
		require('../queue').default();
	} else {
		await require('../server').default();
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
