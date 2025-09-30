import React, { useRef } from "react";
import { useLocation } from "react-router-dom";
import TripSummaryCard from "../components/TripSummaryCard.jsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const TripSummary = () => {
  const location = useLocation();
  const routeData = location.state?.route;
  const cardRef = useRef();

  if (!routeData) {
    return (
      <p className="text-center mt-20">No trip data. Plan a route first.</p>
    );
  }

  const handleDownload = async () => {
    const canvas = await html2canvas(cardRef.current);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${routeData.origin}_to_${routeData.destination}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-12">
      <h1 className="text-3xl font-bold mb-6 text-center">Trip Summary</h1>
      <div ref={cardRef}>
        <TripSummaryCard
          origin={routeData.origin}
          destination={routeData.destination}
          routeCoords={routeData.coords}
          distance={routeData.distance}
          duration={routeData.duration}
        />
      </div>

      <div className="text-center mt-6">
        <button
          onClick={handleDownload}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors"
        >
          Download Trip Summary as PDF
        </button>
      </div>
    </div>
  );
};

export default TripSummary;
