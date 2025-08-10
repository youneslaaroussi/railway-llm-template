interface Window {
  gtag(
    event: 'config',
    trackingId: string,
    config: { page_path: URL },
  ): void;
  gtag(
    event: 'event',
    action: string,
    params: {
      event_category: string;
      event_label: string;
      value: number;
    },
  ): void;
} 