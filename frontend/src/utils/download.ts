import type { AxiosInstance } from 'axios';

export async function downloadFile(api: AxiosInstance, url: string, filename: string, params?: object, mimeType?: string) {
  try {
    const response = await api.get(url, { params, responseType: 'blob' });
    const type = mimeType || response.headers['content-type'] || 'application/octet-stream';
    const blob = new Blob([response.data], { type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (err: any) {
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed.error || 'Download failed');
      } catch (parseErr: any) {
        if (parseErr.message && parseErr.message !== 'Download failed') {
          throw parseErr;
        }
      }
    }
    throw err;
  }
}

export async function downloadExcel(api: AxiosInstance, url: string, filename: string, params?: object) {
  return downloadFile(api, url, filename, params, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

