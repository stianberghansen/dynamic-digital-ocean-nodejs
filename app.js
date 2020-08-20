const minimist = require('minimist');
const readline = require('readline')
const axios = require('axios');

var TIMEOUT_INTERVAL;
var DOMAIN;
var NAME;
var API_KEY;
var SERVER_IP;
var DOMAIN_IP;
var attempt = 1;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const args = minimist(process.argv.slice(2));

const defaultExit = () => {
    console.log("Missing argument(s) to run program. Try -h for more information.")
    process.exit(-1)
}

const parseArguments = () => {
    if (args.h === true || args.help) {
        console.log("No help here yet")
    }
    if (!args.t || !args.d || !args.n || !args.a) {
        defaultExit()
    } else {
        TIMEOUT_INTERVAL = args.t * 1000;
        DOMAIN = args.d;
        NAME = args.n;
        API_KEY = args.a;

        fetchIP();
    }
}

const fetchIP = () => {
    axios.get('https://api.ipify.org?format=json')
        .then(res => {
            if (res.status === 200) {
                SERVER_IP = res.data.ip;
                console.log("Your public IP address is: " + SERVER_IP);
                fetchRecords();
            } else {
                console.log("Error finding public IP address.")
                process.exit(-1);
            }
        })
        .catch(error => {
            console.log(error);
        })
}

const fetchRecords = () => {
    axios.get('https://api.digitalocean.com/v2/domains/' + DOMAIN + '/records', {
        headers: {
            Authorization: `Bearer ${API_KEY}`
        }
    })
        .then((res) => {
            if (res.status === 200) {
                console.log("Found domain records. Parsing data...\n");
                parseDomainRecords(res.data.domain_records);
            }
        })
        .catch((error) => {
            console.log(error)
        })
}

const parseDomainRecords = (data) => {
    const nameMatch = data.find(({ name }) => name === NAME);
    console.log(nameMatch)
    if (nameMatch != undefined && nameMatch.name === NAME) {
        console.log("Found a matching record. Name: " + nameMatch.name + "- Currently pointed at IP:" + nameMatch.data)
        updateDomainRecords(nameMatch.id, nameMatch.data);
    } else {
        console.log("No matching domain records.");
        rl.question("Would you like to create a new domain record: yes / no (y/n)\n", (answer) => {
            if (answer === "yes" || answer === "y") {
                console.log("creating new record...");
                createNewDomainRecord(data.data);
            } else if (answer === "no" || answer === "n") {
                console.log("Exiting program...");
                rl.close();
            }
        })
    }
}

const updateDomainRecords = (id, ip) => {
    if (ip === SERVER_IP) {
        console.log("Domain record IP and server IP match. Checking again in: " + TIMEOUT_INTERVAL/1000 + "s");
        setTimeout(fetchIP, TIMEOUT_INTERVAL);
    } else {
        console.log("New IP detected. Updating domain records...")
        const url = 'https://api.digitalocean.com/v2/domains/' + DOMAIN + '/records/' + id
        axios({
            method: 'put',
            url: 'https://api.digitalocean.com/v2/domains/' + DOMAIN + '/records/' + id,
            headers: {Authorization: `Bearer ${API_KEY}`},
            data: {"data": SERVER_IP }
        })
            .then(res => {
                if (res.status === 200) {
                    console.log("Domain records updated.");
                    setTimeout(fetchIP, TIMEOUT_INTERVAL);
                } else {
                    console.log("Error updating domain records... Retrying" + attempt);
                    attempt++;
                    if (attempt < 5) {
                        setTimeout(updateDomainRecords, 5000);
                    } else {
                        console.log("Unable to update domain records.")
                        process.exit(-1);
                    }
                }
            })
            .catch(error => {
                console.log("Error updating domain records... See error response below:");
                console.log(error);
            })
    }
}

const createNewDomainRecord = () => {
    const newDomainRecord = {
        "type": "A",
        "name": NAME,
        "data": SERVER_IP,
        "priority": null,
        "port": null,
        "ttl": 30,
        "weight": null,
        "flags": null,
        "tag": null
    }
    console.log(newDomainRecord + "\n");
    axios({
        method: 'post',
        url: 'https://api.digitalocean.com/v2/domains/' + DOMAIN + '/records',
        data: newDomainRecord,
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}`}
    })
        .then(res => {
            if (res.status === 201) {
                console.log("New domain record created.");
                console.log(res.data);
                setTimeout(fetchIP, TIMEOUT_INTERVAL)
            }
        })
        .catch(error => {
            console.log(error)
        })
}

parseArguments();