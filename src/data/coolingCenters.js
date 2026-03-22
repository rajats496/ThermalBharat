import { indianCities } from './indianCities'

const templates = [
	{
		suffix: 'Central Community Cooling Hub',
		suffixHindi: 'केंद्रीय सामुदायिक शीतलन केंद्र',
		latOffset: 0.015,
		lonOffset: 0.012
	},
	{
		suffix: 'Municipal Relief Shelter',
		suffixHindi: 'नगर राहत केंद्र',
		latOffset: -0.012,
		lonOffset: 0.014
	},
	{
		suffix: 'Health Heat Safety Point',
		suffixHindi: 'स्वास्थ्य ताप सुरक्षा केंद्र',
		latOffset: 0.01,
		lonOffset: -0.013
	}
]

export const coolingCenters = indianCities.flatMap((city) =>
	templates.map((template, index) => ({
		name: `${city.name} ${template.suffix}`,
		nameHindi: `${city.nameHindi} ${template.suffixHindi}`,
		address: `${index + 1}, ${city.name} Relief Zone, ${city.state}`,
		latitude: Number((city.latitude + template.latOffset).toFixed(6)),
		longitude: Number((city.longitude + template.lonOffset).toFixed(6)),
		city: city.name,
		openTime: '9:00 AM',
		closeTime: '8:00 PM',
		facilities: ['Drinking water', 'AC/Fan', 'First Aid'],
		free: true
	}))
)
