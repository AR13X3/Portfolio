// Generated from a local run of SiteScore's own API (a scratch copy of the repo with
// SITESCORE_OFFLINE=1 and its committed demo pack: real ABS, TfNSW and OSM rows), as_of 2026-10-20.
// The dollar figures are the model's demo-pack outputs, not real business results.

export const AS_OF = '2026-10-20';
export const OPEN_DATE = '2026-11-01';
export const RUNS = 300;

export interface SiteRun {
  n: string;
  label: string;
  lat: number;
  lon: number;
  /** Position on the heat map's SVG grid (HEAT_W × HEAT_H units). */
  x: number;
  y: number;
  rank: number;
  total: number;
  p10: number;
  p90: number;
  profit: number;
  mature: number;
  probBest: number;
  probLoss: number;
  /** Central estimate, month by month. */
  months: number[];
  bandP10: number[];
  bandP90: number[];
  /** Where the site's hex cell sits in the region ("Top 4%"). */
  area: string;
}

/** The workspace's three demo sites (frontend/src/views/WorkspaceView.tsx DEMO_SITES). */
export const SITES: SiteRun[] = [{"n":"01","label":"Church St, Parramatta","lat":-33.815,"lon":151.0035,"x":1026,"y":1272,"rank":3,"total":1263856,"p10":844130,"p90":1595862,"profit":-564267,"mature":39265,"probBest":0.1633,"probLoss":0.99,"months":[7483,12200,14520,22739,27576,27683,32890,33756,32552,37096,37024,37247,40535,35438,30465,38926,41145,37481,41476,40380,37418,41364,40349,39884,42809,37039,31598,40103,42181,38299,42241,41037,37989,41889,40786,40255],"bandP10":[4434,7315,8873,14333,17592,17644,20979,21670,20928,23902,23806,24114,26426,23216,20039,25807,27495,25177,27941,27258,25287,27928,27260,26969,28976,25110,21450,27273,28720,26060,28791,27962,25828,28533,27766,27388],"bandP90":[10749,16263,18866,28710,34231,34089,40284,41332,39742,45701,45949,46405,50671,44336,38300,48954,51903,47437,52662,51301,47622,52973,51819,51325,55178,47682,40540,51621,54280,49198,54384,52836,48803,53946,52516,51782],"area":"Top 10%"},{"n":"02","label":"Harris Park","lat":-33.8226,"lon":151.0085,"x":1115,"y":1433,"rank":2,"total":1289005,"p10":828646,"p90":1792290,"profit":-384752,"mature":35377,"probBest":0.01,"probLoss":0.92,"months":[7466,12651,15828,22722,27556,28993,32867,33732,34095,37079,37525,38473,40543,36808,33268,38978,41213,39360,41564,40465,39301,41438,40958,41231,42820,38431,34426,40049,42107,40034,42126,40906,39649,41734,41191,41417],"bandP10":[4005,7181,9225,13842,17027,17840,20081,20884,21258,23045,23581,24355,25687,23402,21169,24928,26525,25265,26684,25948,25530,26800,26666,27036,27996,25378,22871,26362,27718,26655,27735,26932,26402,27479,27213,27486],"bandP90":[12229,19314,23005,32513,38950,40399,46190,47400,47538,51319,51687,53302,56180,50932,45970,53746,57101,53960,57751,56208,54077,57598,57026,57459,59566,53521,48068,55703,58620,55811,58767,57057,55370,58201,57493,57859],"area":"Top 25%"},{"n":"03","label":"Wentworth Point","lat":-33.829,"lon":151.075,"x":2296,"y":1569,"rank":1,"total":1806297,"p10":1132481,"p90":2431381,"profit":-6676,"mature":52983,"probBest":0.8267,"probLoss":0.5733,"months":[9759,16917,21782,29673,35986,39028,43435,45139,47541,50797,52473,54987,56794,52757,49075,54511,57617,56654,58076,56541,56557,57897,57726,58789,59796,54938,50666,55900,58772,57549,58800,57096,56996,58252,58005,59014],"bandP10":[5286,9351,12411,17177,20953,23020,25987,27500,29166,30973,32073,33856,35214,32851,30484,34081,36280,35769,36776,35901,35976,36967,36859,37496,38245,35137,32347,35865,37724,36863,37770,36686,36540,37434,37267,37884],"bandP90":[15598,24905,30736,40504,48136,51818,57359,59871,63404,67659,70156,73252,75414,70201,65173,72543,76566,75768,77715,75822,76183,77899,77720,79223,80618,74248,68632,75735,79694,78206,79821,77536,77605,79103,78831,80287],"area":"Top 7%"}];

/** The winner's explanation (sitescore/model/explain.py). */
export const WHY = {"siteId":"s3","headline":"Wentworth Point ranks #1, +26% vs the average candidate: helped by less competition for its customers (+166%); held back by fewer potential customers within walking distance (-40%)","vsAverage":0.2604977833609896,"contributions":[{"key":"demand","label":"Demand","pct":-0.3975},{"key":"fit","label":"Demographic fit","pct":0.0974},{"key":"anchors","label":"Anchors","pct":-0.0277},{"key":"competition","label":"Competition","pct":1.6591},{"key":"behaviour","label":"Customer behaviour","pct":-0.065},{"key":"price","label":"Price response","pct":-0.0296},{"key":"spend","label":"Spend per customer","pct":-0.1849},{"key":"capacity","label":"Capacity","pct":0},{"key":"time","label":"Ramp-up, seasons & growth","pct":-0.003}]};

/** The winner's model layers, multiplied out in the equation ledger. */
export const LAYERS = [{"key":"demand","label":"Demand","factor":3394.437261,"unit":"customers","summary":"3,394 potential customers within walking distance (3,197 residents, 197 workers, 0 commuters), weighted by time of day"},{"key":"fit","label":"Demographic fit","factor":1.295892,"unit":"x","summary":"Local residents fit the customer profile x1.31; biggest driver: share of residents aged 25-34 is above the regional average (+1.4 sd)"},{"key":"anchors","label":"Anchors","factor":1.083333,"unit":"x","summary":"Foot-traffic boost x1.08 from 1 anchors within 250 m (unnamed)"},{"key":"competition","label":"Competition","factor":0.14952,"unit":"share","summary":"Wins 15.0% of local demand (42% with no competitors); 3 competitors within 800 m, nearest 381 m away"},{"key":"behaviour","label":"Customer behaviour","factor":1.122229,"unit":"x","summary":"2,816 simulated customers with varied tastes choose us more often than the plain gravity model predicts (x1.12), incl. our quality edge; with habits, trade reaches 90% of the long run in month 11"},{"key":"price","label":"Price response","factor":0.946777,"unit":"x","summary":"3 competitors within 800 m respond: average price $5.30 -> $5.06; we charge $5.30; our share x0.95"},{"key":"spend","label":"Spend","factor":69.985822,"unit":"$/customer","summary":"757 customers x 5.2 visits/month x $13.50 per visit"}];
export const DYNAMICS = {"factor":0.946999,"summary":"Ramp-up from 17% of mature trade in month 1 to 90% by month 11; seasonal low in January (-11%); 3 approved developments in reach add $4,374/month by month 36"};
