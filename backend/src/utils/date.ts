export function formatDateKolkata(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}

export function parseDateFilter(filter?: string, customStartDate?: string, customEndDate?: string): {
  startDate?: Date;
  endDate?: Date;
} {
  const now = new Date();
  
  // Today in IST
  const getISTStartOfDay = (d: Date) => {
    const copy = new Date(d);
    // Format to YYYY-MM-DD in Asia/Kolkata
    const istStr = copy.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    // Parse as start of that day in UTC offset (+05:30)
    return new Date(`${istStr}T00:00:00.000+05:30`);
  };

  const getISTEndOfDay = (d: Date) => {
    const copy = new Date(d);
    const istStr = copy.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return new Date(`${istStr}T23:59:59.999+05:30`);
  };

  if (filter === 'today') {
    return {
      startDate: getISTStartOfDay(now),
      endDate: getISTEndOfDay(now),
    };
  }

  if (filter === 'yesterday') {
    const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      startDate: getISTStartOfDay(yest),
      endDate: getISTEndOfDay(yest),
    };
  }

  if (filter === 'last7days') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      startDate: getISTStartOfDay(start),
      endDate: getISTEndOfDay(now),
    };
  }

  if (filter === 'thismonth') {
    const istStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const [year, month] = istStr.split('-');
    return {
      startDate: new Date(`${year}-${month}-01T00:00:00.000+05:30`),
      endDate: getISTEndOfDay(now),
    };
  }

  if (filter === 'custom' && customStartDate && customEndDate) {
    return {
      startDate: new Date(`${customStartDate}T00:00:00.000+05:30`),
      endDate: new Date(`${customEndDate}T23:59:59.999+05:30`),
    };
  }

  return {};
}
