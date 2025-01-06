(() => {
    const SERVICE_UUID = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";
    const CHARACTERISTIC_UUID = "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f";

    const connectButton = document.querySelector('.connect');
    const disconnectButton = document.querySelector('.disconnect');
    const logArea = document.querySelector('.logger');
    const sendHexButton = document.querySelector('.send-hex');
    const sendConstructedButton = document.querySelector('.send-construct');
    const hexInput = document.querySelector('.hex-command');

    const constructElements = {
        size: document.querySelector('.construct-size'),
        command: document.querySelector('.construct-command'),
        data: document.querySelector('.construct-data'),
        checksum: document.querySelector('.construct-checksum'),
    };

    let gattServer = null;
    let channel = null;

    const updateControls = (connected) => {
        if (connected) {
            connectButton.setAttribute("disabled", "");
            disconnectButton.removeAttribute("disabled");
            hexInput.removeAttribute("disabled");
            sendHexButton.removeAttribute("disabled");
            sendConstructedButton.removeAttribute("disabled");
        } else {
            disconnectButton.setAttribute("disabled", "");
            connectButton.removeAttribute("disabled");
            hexInput.setAttribute("disabled", "");
            sendHexButton.setAttribute("disabled", "");
            sendConstructedButton.setAttribute("disabled", "");
        }
    }

    const bufToString = (buf) => {
        return new TextDecoder().decode(buf);
    }

    const bufToHex = (buf) => {
        let arr = [];

        if (buf instanceof DataView) {
            for (let i = 0; i < buf.byteLength; i++) {
                arr.push(buf.getUint8(i));
            }
        } else if (buf instanceof Uint8Array) {
            arr = Array.from(buf);
        } else {
            arr = buf;
        }

        console.log(arr)

        return arr.map(
            (i) => i.toString(16).padStart(2, "0").toUpperCase()
        ).join(" ");
    }

    const hexToBuf = (value) => {
        if (!value) {
            return new Uint8Array();
        }

        const match = value.match(/[\da-f]{2}/gi);

        if (!match) {
            return new Uint8Array();
        }

        const bytes = new Uint8Array(match.map((h) => {
            return parseInt(h, 16)
        }));

        return bytes;
    }

    const logger = (text) => {
        console.log(text);
        logArea.innerText += text + "\n";
        logArea.scrollTop = logArea.scrollHeight;
    };

    const onDisconnect = () => {
        updateControls(false);
        logger("Disconnected");
    };

    const onPacket = (dw) => {
        logger(`<< ${bufToHex(dw)}`);
        logger(`<S ${bufToString(dw)}`);
    };

    const disconnect = () => {
        if (gattServer !== null) {
            gattServer.disconnect();
            gattServer = null;
            channel = null;
        }
    };

    const updateChecksum = () => {
        let checksum = 0;
        hexToBuf(constructElements.command.value).forEach((i) => (checksum ^= i));
        hexToBuf(constructElements.size.value).forEach((i) => (checksum ^= i));
        hexToBuf(constructElements.data.value).forEach((i) => (checksum ^= i));
        constructElements.checksum.value = bufToHex([checksum & 0xff ]);
    }

    const connect = async () => {
        const options = {
            filters: [
                { namePrefix: "B" },
                { namePrefix: "D" },
                { services: [SERVICE_UUID] }
            ]
        };
        const device = await navigator.bluetooth.requestDevice(options);

        if (device.gatt === undefined) {
            throw new Error("Packet response command is not defined");
        }

        const disconnectListener = () => {
            gattServer = null;
            channel = null;
            device.removeEventListener('gattserverdisconnected', disconnectListener);
            onDisconnect();
        }

        device.addEventListener('gattserverdisconnected', disconnectListener);

        const _gattServer = await device.gatt.connect();

        const service = await _gattServer.getPrimaryService(SERVICE_UUID);

        const _channel = await service.getCharacteristic(CHARACTERISTIC_UUID);

        _channel.addEventListener('characteristicvaluechanged', (event) => {
            onPacket(event.target.value);
        });

        await _channel.startNotifications();

        gattServer = _gattServer;
        channel = _channel;
    };

    connectButton.onclick = async () => {
        connectButton.setAttribute("disabled", "");

        try {
            await connect();
            logger("Connected");
        } catch (e) {
            alert(e);
        }
        updateControls(channel !== null);
    };

    disconnectButton.onclick = async () => {
        disconnect();
    };

    const sendHex = async () => {
        if (channel === null) {
            return;
        }

        const bytes = hexToBuf(hexInput.value);

        if (!bytes.length == 0) {
            return;
        }

        logger(`>> ${bufToHex(bytes)}`);
        await channel.writeValueWithoutResponse(bytes);
    };

    const sendConstructed = async () => {
        if (channel === null) {
            return;
        }

        const bytes = [];
        
        bytes.push(0x55, 0x55);
        bytes.push(...hexToBuf(constructElements.command.value));
        bytes.push(...hexToBuf(constructElements.size.value));
        bytes.push(...hexToBuf(constructElements.data.value));
        bytes.push(...hexToBuf(constructElements.checksum.value));
        bytes.push(0xaa, 0xaa);

        logger(`>> ${bufToHex(bytes)}`);
        await channel.writeValueWithoutResponse(new Uint8Array(bytes));
    };

    hexInput.addEventListener("keypress", async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            await sendHex();
        }
    });

    sendHexButton.onclick = async () => {
        await sendHex();
    };

    sendConstructedButton.onclick = async () => {
        await sendConstructed();
    };

    constructElements.data.oninput = () => {
        const bytes = hexToBuf(constructElements.data.value);
        constructElements.size.value = bufToHex([bytes.length]);
        updateChecksum();
    };

    constructElements.command.oninput = () => {
        updateChecksum();
    };
})()