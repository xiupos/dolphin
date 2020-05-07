import * as S3 from 'aws-sdk/clients/s3';
import config from '../../config';
import { Meta } from '../../models/entities/meta';
import { getAgentByUrl } from '../../misc/fetch';

export function getS3(meta: Meta) {
	const u = config.drive.endpoint != null
		? `${config.drive.useSSL ? 'https://' : 'http://'}${config.drive.endpoint}`
		: `${config.drive.useSSL ? 'https://' : 'http://'}example.net`;

	console.log(JSON.stringify(config.drive, null, 2));
	return new S3({
		endpoint: config.drive.endpoint,
		accessKeyId: config.drive.accessKey,
		secretAccessKey: config.drive.secretKey,
		region: config.drive.region,
		sslEnabled: config.drive.useSSL,
		s3ForcePathStyle: true,
		httpOptions: {
			agent: getAgentByUrl(new URL(u))
		}
	});
}
