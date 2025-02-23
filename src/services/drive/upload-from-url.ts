import create from './add-file';
import { User } from '../../models/entities/user';
import { driveLogger } from './logger';
import { createTemp } from '../../misc/create-temp';
import { downloadUrl } from '../../misc/download-url';
import { DriveFolder } from '../../models/entities/drive-folder';
import { DriveFile } from '../../models/entities/drive-file';
import { DriveFiles } from '../../models';

const logger = driveLogger.createSubLogger('downloader');

export default async (
	url: string,
	user: User | null,
	folderId: DriveFolder['id'] | null = null,
	uri: string | null = null,
	sensitive = false,
	force = false,
	link = false
): Promise<DriveFile> => {
	let name = new URL(url).pathname.split('/').pop() || null;
	if (name == null || !DriveFiles.validateFileName(name)) {
		name = null;
	}

	// Create temp file
	const [path, cleanup] = await createTemp();

	// write content at URL to temp file
	try {
		await downloadUrl(url, path);
	} catch (e) {
		cleanup();
		logger.error(`Failed to download file: ${e}`, {
			url: url,
			e: e
		});
		throw e;
	}

	let driveFile: DriveFile;
	let error;

	try {
		driveFile = await create(user, path, name, null, folderId, force, link, url, uri, sensitive);
		logger.succ(`Got: ${driveFile.id}`);
	} catch (e) {
		error = e;
		logger.error(`Failed to create drive file: ${e}`, {
			url: url,
			e: e
		});
	}

	// clean-up
	cleanup();

	if (error) {
		throw error;
	} else {
		return driveFile!;
	}
};
