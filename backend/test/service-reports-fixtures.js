const d = require("../serviceReports/domain");
function fixture(companyType = "GST") {
  const report = d.normalize({
    header: {
      reportDate: "2026-11-07",
      serviceDate: "2026-11-07",
      startTime: "09:00",
      endTime: "10:00",
      customerName: "QA Example Customer — SYNTHETIC",
      siteName: "QA Commercial Kitchen",
      siteAddress: "100 Synthetic Test Lane, QA City 110001",
      contactPerson: "QA Representative",
      mobile: "9000000000",
      email: "customer@example.invalid",
      serviceType: "General Pest Control",
      companyType,
    },
    links: {
      customerId: "QA-CUSTOMER-1",
      premiseId: "QA-SITE-1",
      jobId: "QA-JOB-1",
      contractReference: "QA-INVOICE-1",
      contractSource: "invoice",
      scheduleReference: "QA-INVOICE-1-2026-11-07-1-0",
    },
    assignees: ["QA-EMP-2"],
    summary: {
      visitPurpose: "Synthetic inspection fixture for local QA only.",
      serviceStatus: "Completed",
      overallActivity: "Low",
      mainFindings:
        "Synthetic observation: low activity recorded at test monitoring point.",
      workCompleted:
        "Synthetic treatment entry recorded for PDF and workflow testing.",
      outstandingIssues: "Test sealing recommendation remains pending.",
      customerObservations: "QA observation only.",
      remarks: "No real treatment or compliance claim.",
    },
    findings: [
      {
        entryId: "QA-FINDING-1",
        pestType: "Cockroaches",
        species: "Not identified",
        activityLevel: "Low",
        area: "QA kitchen",
        evidence: "Synthetic test observation",
        estimatedCount: "2",
        description: "Test finding for report layout verification.",
        comparison: "No previous measurement available",
        remarks: "Synthetic data",
      },
    ],
    treatments: [
      {
        entryId: "QA-TREATMENT-1",
        serviceType: "General Pest Control",
        area: "QA kitchen perimeter",
        method: "Monitoring / Inspection Only",
        workPerformed: "Synthetic recorded inspection for local testing.",
        equipment: "QA inspection torch",
        monitoringDevices: "QA monitoring point M-01",
        startTime: "09:10",
        endTime: "09:40",
        remarks: "No actual chemical application performed.",
        products: [
          {
            name: "QA Product — not an actual application",
            registration: "Synthetic reference only",
            dilution: "Not applicable; no chemical application",
            quantity: "0",
            unit: "mL",
          },
        ],
        treatedZone: "QA Zone A",
        networkInspection: "Not applicable",
        junctionBoxes: "Not applicable",
        refillPoints: "Not applicable",
        observedDamage: "Not assessed",
        recommendedMonitoring: "Test monitoring entry",
      },
    ],
    safety: {
      ppe: "QA record only",
      precautions: "Synthetic QA; no operating instructions supplied.",
      reentry: "Not applicable",
      foodWater: "Not applicable",
      labelReference: "No product label used in synthetic testing.",
      incidents: "No incident assessment performed.",
    },
    recommendations: [
      {
        entryId: "QA-REC-1",
        category: "Entry Point Sealing",
        area: "QA kitchen",
        observation: "Synthetic gap observation",
        action: "Review and seal the recorded test gap after site assessment.",
        priority: "Normal",
        responsibleParty: "QA customer",
        targetDate: "2026-11-14",
        completionStatus: "Proposed",
      },
    ],
    acknowledgement: {
      technicianName: "QA Technician",
      technicianDesignation: "QA Service Staff",
      customerName: "QA Representative",
      customerDesignation: "QA Site Representative",
      customerResponse: "Unavailable",
      reason: "Synthetic test: representative unavailable.",
      acknowledgement:
        "Receipt of recorded service details only. No pest-elimination certification or waiver of rights.",
    },
    followup: {
      required: "Yes",
      nextVisitDate: "2026-11-14",
      reason: "Synthetic monitoring follow-up",
      correctiveActions: "Review proposed sealing action.",
      monitoring: "Review QA monitoring point M-01.",
      customerInstructions: "Synthetic instructions for test output only.",
      internalNotes:
        "CONFIDENTIAL_INTERNAL_SENTINEL must never appear in customer PDF",
    },
    safetyBank: "CONFIDENTIAL_BANK_SENTINEL",
    credentials: "CONFIDENTIAL_SECRET_SENTINEL",
  });
  if (companyType === "NON_GST") {
    report.links.jobId = "";
    report.links.contractReference = "QA-INVOICE-NON-GST";
    report.links.scheduleReference = "QA-INVOICE-NON-GST-2026-11-07-1-0";
  }
  return report;
}
module.exports = { fixture };
