require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const https = require('https');

const router = express.Router();

// Trust all certificates (for dev/testing)
const agent = new https.Agent({ rejectUnauthorized: false });

// SAP Leave WSDL URL
const SAP_LEAVE_URL = `${process.env.SAP_PO_URL}zsrv_emp54_leave?sap-client=${process.env.SAP_CLIENT}`;

router.post('/employee-leave', async (req, res) => {
  const { employeeId } = req.body;

  const soapEnvelope = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:urn="urn:sap-com:document:sap:rfc:functions">
   <soapenv:Header/>
   <soapenv:Body>
      <urn:ZHR_EMP54_LEAVE_FM>
         <EMPLOYEE_ID>${employeeId}</EMPLOYEE_ID>
      </urn:ZHR_EMP54_LEAVE_FM>
   </soapenv:Body>
</soapenv:Envelope>
  `;

  try {
    const response = await axios.post(SAP_LEAVE_URL, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'urn:sap-com:document:sap:rfc:functions:ZHR_EMP54_LEAVE_FM',
      },
      auth: {
        username: process.env.SAP_USERNAME,
        password: process.env.SAP_PASSWORD,
      },
      httpsAgent: agent,
    });

    const xml = response.data;
    console.log('Raw SOAP Response:\n', xml);

    const json = await parseStringPromise(xml, { explicitArray: false });

    // Handle possible envelope namespaces
    const envelope = json['soap-env:Envelope'] || json['soapenv:Envelope'] || json['SOAP-ENV:Envelope'];
    const body = envelope?.['soap-env:Body'] || envelope?.['soapenv:Body'] || envelope?.['SOAP-ENV:Body'];

    if (!body) {
      return res.status(500).json({ error: 'SOAP Body not found' });
    }

    const responseKey = Object.keys(body).find(key => key.includes('ZHR_EMP54_LEAVE_FMResponse'));
    const result = body[responseKey];

    if (!result || !result.LEAVE_DETAILS) {
      return res.status(404).json({ error: 'No leave details found' });
    }

    const leaveItems = result.LEAVE_DETAILS.item;

    const leaveArray = Array.isArray(leaveItems) ? leaveItems : [leaveItems];

    const formattedLeaves = leaveArray.map(item => ({
      employeeId: item.EMP_ID || '',
      startDate: item.START_DATE || '',
      endDate: item.END_DATE || '',
      absenceType: item.AB_TYPE || '',
      absenceDays: item.AB_DAYS || '',
      reason: item.REASON || '',
      quotaNumber: item.QUOTA_NUMBER || '',
      quotaStart: item.START_DATE_QUOTA || '',
      quotaEnd: item.END_DATE_QUOTA || '',
    }));

    res.json({ leaves: formattedLeaves });

  } catch (error) {
    console.error('Leave Fetch Error:', error.message);
    res.status(500).json({ error: 'SAP PI/PO Leave Call Failed' });
  }
});

module.exports = router;
