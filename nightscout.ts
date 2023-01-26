import axios from "axios";
import config from "./config";
import crypto from "crypto";
import { GlucoseUnit } from "./diasend";

interface Base {
  // Required timestamp when the record or event occured, you can choose from three input formats\n- Unix epoch in milliseconds (1525383610088)\n- Unix epoch in seconds (1525383610)\n- ISO 8601 with optional timezone ('2018-05-03T21:40:10.088Z' or '2018-05-03T23:40:10.088+02:00')\n\nThe date is always stored in a normalized form - UTC with zero offset. If UTC offset was present, it is going to be set in the `utcOffset` field.\n\nNote&#58; this field is immutable by the client (it cannot be updated or patched)
  date: number;
  // The device from which the data originated (including serial number of the device, if it is relevant and safe).\n\nNote&#58; this field is immutable by the client (it cannot be updated or patched)
  device?: string;
  // Application or system in which the record was entered by human or device for the first time.\n\nNote&#58; this field is immutable by the client (it cannot be updated or patched)
  app: string;
}

interface Entry extends Base {
  type: "sgv" | "mbg" | "cal" | "etc";
  // ISO datestring
  dateString: string;
}

export type NightscoutGlucoseUnit = "mg" | "mmol";

type SGVDirection =
  | "NONE"
  | "DoubleUp"
  | "SingleUp"
  | "FortyFiveUp"
  | "Flat"
  | "FortyFiveDown"
  | "SingleDown"
  | "DoubleDown"
  | "NOT COMPUTABLE"
  | "RATE OUT OF RANGE";

export interface SensorGlucoseValueEntry extends Entry {
  type: "sgv";
  // the glucose reading
  sgv: number;
  direction?: SGVDirection;
  noise?: number;
  filtered?: number;
  unfiltered?: number;
  rssi?: number;
  units: NightscoutGlucoseUnit; // it is highly recommended by nightscout to define units, so we'll make this required.
}

export interface Treatment extends Base {
  eventType: "Meal Bolus" | "Snack Bolus" | "Correction Bolus";
  // Description/notes of treatment.
  notes?: string;
  // Who entered the treatment.
  enteredBy?: string;
  // For example the reason why the profile has been switched or why the temporary target has been set.
  reason?: string;
  profile?: string;
  // Current glucose.
  glucose?: number;
  // Method used to obtain glucose, Finger or Sensor.
  glucoseType?: "Sensor" | "Finger" | "Manual";
  // The units for the glucose value, mg/dl or mmol/l. It is strongly recommended to fill in this field when `glucose` is entered.
  units?: GlucoseUnit;
}

interface BaseBolusTreatment extends Treatment {
  // Amount of insulin, if any. Given in Units
  insulin: number;
  // How many minutes the bolus was given before the meal started.
  preBolus?: number;
}

export interface CorrectionBolusTreatment extends BaseBolusTreatment {
  eventType: "Correction Bolus";
}

export interface MealBolusTreatment extends BaseBolusTreatment {
  eventType: "Meal Bolus";
  // Amount of carbs given.
  carbs?: number;
  // Amount of protein given.
  protein?: number;
  // Amount of fat given.
  fat?: number;
}

function getNightscoutClient(apiSecret = config.nightscout.apiSecret) {
  if (!apiSecret) {
    throw Error(
      "Nightscout API Secret needs to be defined as an env var 'NIGHTSCOUT_API_SECRET'"
    );
  }

  const shasum = crypto.createHash("sha1");
  shasum.update(apiSecret);
  return axios.create({
    baseURL: config.nightscout.url,
    headers: {
      "api-secret": shasum.digest("hex"),
    },
  });
}

export async function getLatestCgmUpdateOnNightscout() {
  // get only one entry --> the newest one
  const repsonse = await getNightscoutClient().get<SensorGlucoseValueEntry[]>(
    "/api/v1/entries/sgv",
    {
      params: { count: 1 },
    }
  );

  return new Date(repsonse.data[0].date);
}

export async function reportEntriesToNightscout(
  values: SensorGlucoseValueEntry[]
) {
  if (!values.length) return;
  const response = await getNightscoutClient().post<SensorGlucoseValueEntry[]>(
    "/api/v1/entries/",
    values
  );
  return response.data;
}

export async function reportTreatmentsToNightscout(values: Treatment[]) {
  if (!values.length) return;
  const response = await getNightscoutClient().post<Treatment[]>(
    "/api/v1/treatments/",
    values
  );
  return response.data;
}
