import { useMemo, useState } from 'react';
import jsPDF from 'jspdf';

const PDF_THEME = {
  background: '#0f172a',
  panel: '#13213D',
  accent: '#40c4ff',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5F5',
  divider: '#1f335a',
};

const formatDayLabel = (day, fallbackIndex) => {
  if (day?.day) {
    return `Day ${day.day}`;
  }
  if (day?.date) {
    return day.date;
  }
  return `Day ${fallbackIndex + 1}`;
};

const prepareActivities = (day) => {
  if (Array.isArray(day?.activities)) {
    return day.activities;
  }
  if (Array.isArray(day?.items)) {
    return day.items;
  }
  if (Array.isArray(day?.plan)) {
    return day.plan;
  }
  return [];
};

const TripFlowchart = ({ trip }) => {
  const [downloading, setDownloading] = useState(false);

  const itinerary = useMemo(() => {
    if (!trip) return [];
    if (Array.isArray(trip.itinerary)) {
      return trip.itinerary;
    }
    if (Array.isArray(trip.result?.itinerary)) {
      return trip.result.itinerary;
    }
    if (Array.isArray(trip.result?.days)) {
      return trip.result.days;
    }
    return [];
  }, [trip]);

  const eventsByCity = useMemo(() => trip?.result?.events || {}, [trip?.result?.events]);

  const buildPdf = () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 40;
    let cursorY = margin;

    const addHeading = (text, size = 18) => {
      pdf.setFontSize(size);
      pdf.setTextColor(PDF_THEME.textPrimary);
      pdf.text(text, margin, cursorY);
      cursorY += size * 0.7 + 12;
    };

    const addSubheading = (text) => {
      pdf.setFontSize(11);
      pdf.setTextColor(PDF_THEME.textSecondary);
      pdf.text(text, margin, cursorY);
      cursorY += 20;
    };

    const addDivider = () => {
      pdf.setDrawColor(PDF_THEME.divider);
      pdf.setLineWidth(1);
      pdf.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 20;
    };

    const addDayBlock = (day, index) => {
      const blockPadding = 18;
      const lineHeight = 16;
      const activities = prepareActivities(day);
      const events = Array.isArray(eventsByCity[day?.city || day?.destination || `day-${index + 1}`])
        ? eventsByCity[day?.city || day?.destination || `day-${index + 1}`]
        : [];

      const estimatedHeight = blockPadding * 2 + (activities.length || 1) * lineHeight * 1.2 + (events.length || 1) * lineHeight * 1.2 + 60;
      if (cursorY + estimatedHeight > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage();
        pdf.setFillColor(PDF_THEME.background);
        pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');
        cursorY = margin;
      }

      pdf.setFillColor(PDF_THEME.panel);
      pdf.setDrawColor(PDF_THEME.accent);
      pdf.setLineWidth(0.8);
      pdf.roundedRect(margin, cursorY, pageWidth - margin * 2, estimatedHeight, 12, 12, 'FD');

      let innerY = cursorY + blockPadding;
      pdf.setFontSize(12);
      pdf.setTextColor(PDF_THEME.accent);
      pdf.text(`Day ${index + 1}`, margin + blockPadding, innerY);
      pdf.setFontSize(14);
      pdf.setTextColor(PDF_THEME.textPrimary);
      innerY += 20;
      pdf.text(day?.city || day?.title || day?.destination || 'Exploration', margin + blockPadding, innerY);
      innerY += 12;

      if (day?.weather?.weather || day?.weather?.temp) {
        pdf.setFontSize(10);
        pdf.setTextColor(PDF_THEME.textSecondary);
        innerY += 18;
        pdf.text(`Weather: ${day?.weather?.temp ? `${day.weather.temp}°C` : ''} ${day?.weather?.weather || ''}`.trim(), margin + blockPadding, innerY);
      } else {
        innerY += 10;
      }

      innerY += 16;
      pdf.setFontSize(11);
      pdf.setTextColor(PDF_THEME.textPrimary);
      pdf.text('Curated activities', margin + blockPadding, innerY);
      innerY += 14;

      if (activities.length) {
        activities.forEach((activity) => {
          pdf.setFontSize(10);
          pdf.setTextColor(PDF_THEME.textSecondary);
          const meta = [activity?.time, activity?.location, activity?.type].filter(Boolean).join(' • ');
          pdf.text(meta || 'Scheduled block', margin + blockPadding, innerY);
          innerY += 12;
          pdf.setFontSize(11);
          pdf.setTextColor(PDF_THEME.textPrimary);
          pdf.text(activity?.title || 'Untitled activity', margin + blockPadding, innerY);
          innerY += 14;
          if (activity?.notes) {
            pdf.setFontSize(10);
            pdf.setTextColor(PDF_THEME.textSecondary);
            pdf.text(`Notes: ${activity.notes}`, margin + blockPadding, innerY, { maxWidth: pageWidth - (margin + blockPadding) * 2 });
            innerY += 14;
          }
          innerY += 4;
        });
      } else {
        pdf.setFontSize(10);
        pdf.setTextColor(PDF_THEME.textSecondary);
        pdf.text('No activities on record for this segment.', margin + blockPadding, innerY);
        innerY += 16;
      }

      innerY += 4;
      pdf.setFontSize(11);
      pdf.setTextColor(PDF_THEME.textPrimary);
      pdf.text('Event highlights', margin + blockPadding, innerY);
      innerY += 14;

      if (events.length) {
        events.slice(0, 6).forEach((event) => {
          pdf.setFontSize(11);
          pdf.setTextColor(PDF_THEME.textPrimary);
          pdf.text(event?.title || 'Featured event', margin + blockPadding, innerY, { maxWidth: pageWidth - (margin + blockPadding) * 2 });
          innerY += 12;
          pdf.setFontSize(10);
          pdf.setTextColor(PDF_THEME.textSecondary);
          const note = [event?.date, event?.location].filter(Boolean).join(' • ') || 'Details to be announced';
          pdf.text(note, margin + blockPadding, innerY);
          innerY += 14;
        });
      } else {
        pdf.setFontSize(10);
        pdf.setTextColor(PDF_THEME.textSecondary);
        pdf.text('No live events pinned for this day.', margin + blockPadding, innerY);
        innerY += 16;
      }

      cursorY += estimatedHeight + 16;
    };

    pdf.setFillColor(PDF_THEME.background);
    pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

    addHeading(trip?.title || `${trip?.startCity || 'Trip'} → ${trip?.endCity || 'Plan'}`);
    addSubheading('Multi-agent itinerary & live event timeline');
    addDivider();

    itinerary.forEach((day, index) => {
      addDayBlock(day, index);
    });

    const fileName = `${trip?.title || `${trip?.startCity || 'Trip'}-${trip?.endCity || 'Plan'}`}-flowchart.pdf`;
    pdf.save(fileName.replace(/\s+/g, '-').toLowerCase());
  };

  const handleDownload = async () => {
    if (downloading) return;
    try {
      setDownloading(true);
      buildPdf();
    } catch (error) {
      console.error('Failed to export flowchart:', error);
    } finally {
      setDownloading(false);
    }
  };

  if (!itinerary.length) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/85 via-slate-950/80 to-slate-900/80 p-6 shadow-[0_25px_60px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">Flowchart export</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Itinerary & events overview</h3>
          <p className="mt-1 text-sm text-white/60">
            Visualize each day&apos;s pacing alongside event intel. Download the snapshot as a shareable PDF.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-[0_18px_45px_rgba(14,165,233,0.35)] transition hover:shadow-[0_20px_55px_rgba(14,165,233,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>

      <div className="mt-6 space-y-6 rounded-3xl border border-white/5 bg-slate-950/30 p-6">
        {itinerary.map((day, index) => {
          const activities = prepareActivities(day);
          const cityKey = day?.city || day?.destination || `day-${index + 1}`;
          const localEvents = Array.isArray(eventsByCity[cityKey]) ? eventsByCity[cityKey] : [];
          const dayLabel = formatDayLabel(day, index);

          return (
            <div key={`${cityKey}-${index}`} className="grid grid-cols-[auto,1fr] gap-5">
              <div className="flex flex-col items-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-400/20 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-100">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {index !== itinerary.length - 1 && (
                  <span className="mt-2 flex w-px flex-1 bg-gradient-to-b from-cyan-300/60 via-cyan-300/20 to-transparent" />
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/50">{dayLabel}</p>
                    <h4 className="mt-1 text-lg font-semibold text-white">
                      {day?.city || day?.title || day?.destination || 'Exploration'}
                    </h4>
                  </div>
                  {(day?.weather?.temp || day?.weather?.weather) && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">
                      {day?.weather?.temp && <span>{day.weather.temp}°C</span>}
                      {day?.weather?.weather && <span>{day.weather.weather}</span>}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">Curated activities</p>
                    {activities.length ? (
                      <ul className="mt-3 space-y-3">
                        {activities.map((activity, activityIndex) => (
                          <li
                            key={activity?.itemId || activity?.id || `${index}-${activityIndex}`}
                            className="rounded-xl border border-white/10 bg-white/5 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{activity?.title || 'Scheduled block'}</p>
                                {activity?.notes && <p className="mt-1 text-xs text-white/60">{activity.notes}</p>}
                              </div>
                              <div className="flex flex-col items-end text-[11px] uppercase tracking-[0.3em] text-white/50">
                                {activity?.time && <span>{activity.time}</span>}
                                {activity?.location && <span>{activity.location}</span>}
                                {activity?.type && <span>{activity.type}</span>}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
                        No activities on record for this segment.
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">Event highlights</p>
                    {localEvents.length ? (
                      <ul className="mt-3 space-y-3">
                        {localEvents.slice(0, 4).map((event, eventIndex) => (
                          <li
                            key={event?.id || event?.title || `${cityKey}-event-${eventIndex}`}
                            className="rounded-xl border border-white/10 bg-white/5 p-3"
                          >
                            <p className="text-sm font-semibold text-white">{event?.title || 'Featured event'}</p>
                            <p className="mt-1 text-xs text-white/60">
                              {[event?.date, event?.location].filter(Boolean).join(' • ') || 'Details to be announced'}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
                        No live events pinned for this city yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TripFlowchart;
