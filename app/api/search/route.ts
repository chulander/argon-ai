import { NextResponse } from "next/server";
import { ClinicalTrial } from "@/types/clinicalTrials";
import { filterEnumMap } from "@/types/filterEnums";
import _data from "../../../data/ctg-studies.json";
import Fuse from "fuse.js";

// Assert the JSON data as an array of ClinicalTrial
const data = _data as ClinicalTrial[];

// Helper function to extract a sortable string value from a trial for a given field.
function getSortValue(trial: ClinicalTrial, field: string): string {
  switch (field) {
    case "nctId":
      return trial.protocolSection.identificationModule.nctId || "";
    case "briefTitle":
      return trial.protocolSection.identificationModule.briefTitle || "";
    case "organization":
      return (
        trial.protocolSection.identificationModule.organization.fullName || ""
      );
    case "status":
      return trial.protocolSection.statusModule.overallStatus || "";
    case "startDate":
      return trial.protocolSection.statusModule.startDateStruct?.date || "";
    case "completionDate":
      return (
        trial.protocolSection.statusModule.completionDateStruct?.date || ""
      );
    case "officialTitle":
      return trial.protocolSection.identificationModule.officialTitle || "";
    case "briefSummary":
      return trial.protocolSection.descriptionModule.briefSummary || "";
    case "leadSponsor":
      return (
        trial.protocolSection.sponsorCollaboratorsModule.leadSponsor.name || ""
      );
    case "primaryOutcomeMeasure":
      return (
        trial.protocolSection.outcomesModule.primaryOutcomes?.[0]?.measure || ""
      );
    case "enrollmentCount":
      return (
        trial.protocolSection.designModule.enrollmentInfo?.count?.toString() ||
        ""
      );
    case "studyType":
      return trial.protocolSection.designModule.studyType || "";
    case "sex":
      return trial.protocolSection.eligibilityModule.sex || "";
    case "minimumAge":
      return trial.protocolSection.eligibilityModule.minimumAge || "";
    case "maximumAge":
      return trial.protocolSection.eligibilityModule.maximumAge || "";
    case "conditions":
      return (
        trial.protocolSection.conditionsModule?.conditions?.join(" ") || ""
      );
    case "locations":
      return (
        trial.protocolSection.contactsLocationsModule.locations
          ?.map((loc) => loc.facility)
          .join(", ") || ""
      );
    default:
      return "";
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Parse basic parameters
  const term = searchParams.get("term")?.toLowerCase() || "";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam) : 10;
  const pageParam = searchParams.get("page");
  const page = pageParam ? parseInt(pageParam) : 1;

  // Parse sort parameter (comma-separated)
  // e.g., "nctId:asc,briefTitle:asc,organization:asc,status:asc,conditions:asc,startDate:asc,completionDate:desc"
  const sortParam = searchParams.get("sort") || "";
  const sortItems = sortParam
    ? sortParam.split(",").map((item) => {
        const [field, direction] = item.split(":");
        return { field, direction: direction || "asc" };
      })
    : [];

  // Remove any sort instructions for "conditions"
  const effectiveSortItems = sortItems.filter(
    (item) => item.field !== "conditions",
  );

  // Parse explicit filters (using bracket notation, e.g., filter[overallStatus]=RECRUITING)
  const filters: { [key: string]: string } = {};
  for (const [key, value] of searchParams.entries()) {
    const match = key.match(/^filter\[(.+)\]$/);
    if (match) {
      const filterField = match[1];
      filters[filterField] = value.toLowerCase();
    }
  }

  // ---------------------------
  // Use Fuse.js for fuzzy filtering.
  // ---------------------------
  const fuseOptions = {
    keys: [
      {
        name: "protocolSection.conditionsModule.conditions",
        weight: 0.5, // 🔼 Higher priority
      },
      {
        name: "protocolSection.conditionsModule.keywords",
        weight: 0.5, // 🔼 Higher priority
      },
      {
        name: "derivedSection.conditionBrowseModule.meshes.term",
        weight: 0.6, // High priority standardized MeSH term
      },
      {
        name: "derivedSection.conditionBrowseModule.ancestors.term",
        weight: 0.3, // Ancestor MeSH terms, slightly lower priority
      },
      {
        name: "protocolSection.identificationModule.briefTitle",
        weight: 0.2,
      },
      {
        name: "protocolSection.identificationModule.officialTitle",
        weight: 0.2,
      },
      {
        name: "protocolSection.descriptionModule.briefSummary",
        weight: 0.2,
      },
      {
        name: "protocolSection.armsInterventionsModule.armGroups.label",
        weight: 0.1,
      },
      {
        name: "protocolSection.armsInterventionsModule.armGroups.description",
        weight: 0.1,
      },
      {
        name: "protocolSection.armsInterventionsModule.armGroups.interventionNames",
        weight: 0.1,
      },
      {
        name: "protocolSection.armsInterventionsModule.interventions.name",
        weight: 0.1,
      },
      {
        name: "protocolSection.armsInterventionsModule.interventions.description",
        weight: 0.1,
      },
      {
        name: "protocolSection.designModule.phases",
        weight: 0.05,
      },
      {
        name: "protocolSection.identificationModule.organization.fullName",
        weight: 0.05,
      },
      {
        name: "protocolSection.sponsorCollaboratorsModule.leadSponsor.name",
        weight: 0.05,
      },
    ],
    threshold: 0.4,
    includeScore: true,
  };
  let filteredData: ClinicalTrial[] = [];
  if (term) {
    const fuse = new Fuse(data, fuseOptions);
    const fuseResults = fuse.search(term);
    filteredData = fuseResults.map((result) => result.item);
  } else {
    filteredData = [...data];
  }

  // ---------------------------
  // Apply explicit filters.
  // ---------------------------
  filteredData = filteredData.filter((trial) => {
    return Object.entries(filters).every(([field, filterValue]) => {
      const isEnumField = field in filterEnumMap;
      let actualValue: string | undefined = "";

      switch (field) {
        case "overallStatus":
          actualValue = trial.protocolSection.statusModule.overallStatus;
          break;
        case "studyType":
          actualValue = trial.protocolSection.designModule?.studyType;
          break;
        case "nctId":
          actualValue = trial.protocolSection.identificationModule.nctId;
          break;
        case "briefTitle":
          actualValue = trial.protocolSection.identificationModule.briefTitle;
          break;
        case "organization":
          actualValue =
            trial.protocolSection.identificationModule.organization.fullName;
          break;
        case "startDate":
          actualValue =
            trial.protocolSection.statusModule.startDateStruct?.date;
          break;
        case "completionDate":
          actualValue =
            trial.protocolSection.statusModule.completionDateStruct?.date;
          break;
        case "officialTitle":
          actualValue =
            trial.protocolSection.identificationModule.officialTitle;
          break;
        case "briefSummary":
          actualValue = trial.protocolSection.descriptionModule.briefSummary;
          break;
        case "leadSponsor":
          actualValue =
            trial.protocolSection.sponsorCollaboratorsModule.leadSponsor.name;
          break;
        case "primaryOutcomeMeasure":
          actualValue =
            trial.protocolSection.outcomesModule.primaryOutcomes?.[0]?.measure;
          break;
        case "enrollmentCount":
          actualValue =
            trial.protocolSection.designModule.enrollmentInfo?.count?.toString();
          break;
        case "sex":
          actualValue = trial.protocolSection.eligibilityModule.sex;
          break;
        case "minimumAge":
          actualValue = trial.protocolSection.eligibilityModule.minimumAge;
          break;
        case "maximumAge":
          actualValue = trial.protocolSection.eligibilityModule.maximumAge;
          break;
        case "conditions":
          actualValue = trial.protocolSection.conditionsModule?.conditions
            ?.join(" ")
            .toLowerCase();
          break;
        case "locations":
          actualValue = trial.protocolSection.contactsLocationsModule.locations
            ?.map((loc) => loc.facility)
            .join(", ");
          break;
        default:
          return true;
      }

      if (!actualValue) return false;

      const normalizedActual = actualValue.toLowerCase();

      return isEnumField
        ? normalizedActual === filterValue
        : normalizedActual.includes(filterValue);
    });
  });

  // ---------------------------
  // Apply multi-field sorting for effectiveSortItems.
  // ---------------------------
  if (effectiveSortItems.length > 0) {
    filteredData.sort((a, b) => {
      for (const sortItem of effectiveSortItems) {
        const aValue = getSortValue(a, sortItem.field);
        const bValue = getSortValue(b, sortItem.field);
        const cmp = aValue.localeCompare(bValue, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (cmp !== 0) {
          return sortItem.direction === "asc" ? cmp : -cmp;
        }
      }
      return 0;
    });
  }

  // ---------------------------
  // Pagination: Calculate total count, total pages, and slice the data.
  // ---------------------------
  const totalCount = filteredData.length;
  const totalPages = Math.ceil(totalCount / limit);
  const startIndex = (page - 1) * limit;
  const pagedData = filteredData.slice(startIndex, startIndex + limit);

  // If fullResults=true is present, return full matching IDs (ignoring pagination)
  if (searchParams.get("fullResults") === "true") {
    const nctIds = filteredData.map(
      (trial) => trial.protocolSection.identificationModule.nctId,
    );
    return NextResponse.json({
      success: true,
      nctIds,
      totalCount,
      totalPages,
    });
  }

  return NextResponse.json({
    success: true,
    data: pagedData,
    totalCount,
    totalPages,
  });
}
