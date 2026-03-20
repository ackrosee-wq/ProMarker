// ProMarker - Premiere Pro ExtendScript
// Marker operations for the active sequence
//
// This file is loaded via CSInterface.evalScript from the CEP panel.
// It provides functions to read, add, remove, and update sequence markers.

// ==========================================================================
// JSON2 polyfill for ExtendScript (which lacks native JSON support)
// Minimal implementation covering stringify and parse.
// ==========================================================================
if (typeof JSON === 'undefined') {
    JSON = {};
}

(function () {
    'use strict';

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {
            var indent = '';
            var gap = '';

            if (typeof space === 'number') {
                for (var i = 0; i < space; i++) {
                    gap += ' ';
                }
            } else if (typeof space === 'string') {
                gap = space;
            }

            function str(key, holder) {
                var value = holder[key];
                var type = typeof value;

                if (value === null) return 'null';
                if (type === 'undefined') return undefined;
                if (type === 'boolean') return value ? 'true' : 'false';
                if (type === 'number') {
                    return isFinite(value) ? String(value) : 'null';
                }
                if (type === 'string') return quote(value);

                // Array
                if (value instanceof Array) {
                    var partial = [];
                    for (var i = 0; i < value.length; i++) {
                        var v = str(i, value);
                        partial.push(v === undefined ? 'null' : v);
                    }
                    if (partial.length === 0) return '[]';
                    if (gap) {
                        var oldIndent = indent;
                        indent += gap;
                        var result = '[\n' + indent;
                        result += partial.join(',\n' + indent);
                        indent = oldIndent;
                        result += '\n' + indent + ']';
                        return result;
                    }
                    return '[' + partial.join(',') + ']';
                }

                // Object
                if (type === 'object') {
                    var partial = [];
                    for (var k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            var v = str(k, value);
                            if (v !== undefined) {
                                partial.push(quote(k) + ':' + (gap ? ' ' : '') + v);
                            }
                        }
                    }
                    if (partial.length === 0) return '{}';
                    if (gap) {
                        var oldIndent = indent;
                        indent += gap;
                        var result = '{\n' + indent;
                        result += partial.join(',\n' + indent);
                        indent = oldIndent;
                        result += '\n' + indent + '}';
                        return result;
                    }
                    return '{' + partial.join(',') + '}';
                }

                return undefined;
            }

            function quote(str) {
                var result = '"';
                for (var i = 0; i < str.length; i++) {
                    var c = str.charAt(i);
                    if (c === '"' || c === '\\') {
                        result += '\\' + c;
                    } else if (c === '\n') {
                        result += '\\n';
                    } else if (c === '\r') {
                        result += '\\r';
                    } else if (c === '\t') {
                        result += '\\t';
                    } else if (c === '\b') {
                        result += '\\b';
                    } else if (c === '\f') {
                        result += '\\f';
                    } else {
                        var code = c.charCodeAt(0);
                        if (code < 32) {
                            var hex = code.toString(16);
                            while (hex.length < 4) hex = '0' + hex;
                            result += '\\u' + hex;
                        } else {
                            result += c;
                        }
                    }
                }
                result += '"';
                return result;
            }

            return str('', { '': value });
        };
    }

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text) {
            // Minimal safe parse using eval with basic validation
            // In ExtendScript this is acceptable since input is trusted
            if (typeof text !== 'string') {
                throw new Error('JSON.parse: input must be a string');
            }
            text = String(text);
            // Remove leading/trailing whitespace
            text = text.replace(/^\s+/, '').replace(/\s+$/, '');
            if (!text) throw new Error('JSON.parse: empty string');
            // Basic safety check - reject obvious non-JSON
            if (/^[\],:{}\s]*$/.test(
                text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                    .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                    .replace(/(?:^|:|,)(?:\s*\[)+/g, '')
            )) {
                return eval('(' + text + ')');
            }
            throw new Error('JSON.parse: invalid JSON');
        };
    }
})();

// ==========================================================================
// Utility functions
// ==========================================================================

/**
 * Map a Premiere Pro marker color index to a human-readable color name.
 * Premiere marker color indices:
 *   0=Green, 1=Red, 2=Purple, 3=Orange, 4=Yellow, 5=White, 6=Blue, 7=Cyan
 */
function markerColorToString(colorIndex) {
    var colors = ['green', 'red', 'purple', 'orange', 'yellow', 'white', 'blue', 'cyan'];
    if (typeof colorIndex === 'number' && colorIndex >= 0 && colorIndex < colors.length) {
        return colors[colorIndex];
    }
    return 'green';
}

/**
 * Map a color name back to Premiere Pro's marker color index.
 */
function colorStringToIndex(colorName) {
    if (typeof colorName !== 'string') return 0;
    var name = colorName.toLowerCase();
    var map = {
        'green': 0,
        'red': 1,
        'purple': 2,
        'orange': 3,
        'yellow': 4,
        'white': 5,
        'blue': 6,
        'cyan': 7
    };
    if (map.hasOwnProperty(name)) {
        return map[name];
    }
    return 0;
}

/**
 * Safely get the active sequence, or null.
 */
function safeGetActiveSequence() {
    try {
        if (app && app.project && app.project.activeSequence) {
            return app.project.activeSequence;
        }
    } catch (e) {
        // Sequence may not be available
    }
    return null;
}

// ==========================================================================
// Public API - called from CEP panel via evalScript
// ==========================================================================

/**
 * Get the project directory path (without the .prproj filename).
 * @returns {string} The directory containing the project file, or ''.
 */
function getProjectPath() {
    try {
        var project = app.project;
        if (project && project.path) {
            var fullPath = project.path;
            // Remove the filename, keep just the directory
            // Handle both forward and back slashes
            var lastSlash = fullPath.lastIndexOf('/');
            var lastBackslash = fullPath.lastIndexOf('\\');
            var sep = Math.max(lastSlash, lastBackslash);
            if (sep >= 0) {
                return fullPath.substring(0, sep + 1);
            }
            return fullPath;
        }
        return '';
    } catch (e) {
        return '';
    }
}

/**
 * Get the name of the active sequence.
 * @returns {string} Sequence name or ''.
 */
function getActiveSequenceName() {
    try {
        var seq = safeGetActiveSequence();
        return seq ? seq.name : '';
    } catch (e) {
        return '';
    }
}

/**
 * Get all markers from the active sequence.
 * @returns {string} JSON array of marker objects.
 */
function getSequenceMarkers() {
    try {
        var seq = safeGetActiveSequence();
        if (!seq) return '[]';

        var markers = seq.markers;
        if (!markers) return '[]';

        var result = [];
        var numMarkers = markers.numMarkers;

        if (typeof numMarkers === 'undefined' || numMarkers === 0) {
            // Try iteration approach if numMarkers is not available
            var marker = markers.getFirstMarker();
            while (marker) {
                var markerObj = {};
                markerObj.name = marker.name || '';
                markerObj.time = 0;
                markerObj.duration = 0;
                markerObj.color = 'green';
                markerObj.guid = '';

                // Get time safely
                try {
                    markerObj.time = marker.start.seconds;
                } catch (te) {
                    markerObj.time = 0;
                }

                // Get duration safely
                try {
                    var endSec = marker.end.seconds;
                    var startSec = marker.start.seconds;
                    markerObj.duration = endSec - startSec;
                    if (markerObj.duration < 0) markerObj.duration = 0;
                } catch (de) {
                    markerObj.duration = 0;
                }

                // Get color safely
                try {
                    var cIdx = marker.getColorByIndex(marker.colorIndex || 0);
                    markerObj.color = markerColorToString(cIdx);
                } catch (ce) {
                    // Some Premiere versions expose color differently
                    try {
                        markerObj.color = markerColorToString(marker.colorIndex || 0);
                    } catch (ce2) {
                        markerObj.color = 'green';
                    }
                }

                // Get GUID safely
                try {
                    markerObj.guid = marker.guid || '';
                } catch (ge) {
                    markerObj.guid = '';
                }

                result.push(markerObj);

                try {
                    marker = markers.getNextMarker(marker);
                } catch (ne) {
                    break;
                }
            }
        } else {
            // Use indexed access if numMarkers is available
            var marker = markers.getFirstMarker();
            while (marker) {
                var markerObj = {};
                markerObj.name = marker.name || '';
                markerObj.time = 0;
                markerObj.duration = 0;
                markerObj.color = 'green';
                markerObj.guid = '';

                try {
                    markerObj.time = marker.start.seconds;
                } catch (te) {
                    markerObj.time = 0;
                }

                try {
                    var endSec = marker.end.seconds;
                    var startSec = marker.start.seconds;
                    markerObj.duration = endSec - startSec;
                    if (markerObj.duration < 0) markerObj.duration = 0;
                } catch (de) {
                    markerObj.duration = 0;
                }

                try {
                    markerObj.color = markerColorToString(marker.colorIndex || 0);
                } catch (ce) {
                    markerObj.color = 'green';
                }

                try {
                    markerObj.guid = marker.guid || '';
                } catch (ge) {
                    markerObj.guid = '';
                }

                result.push(markerObj);

                try {
                    marker = markers.getNextMarker(marker);
                } catch (ne) {
                    break;
                }
            }
        }

        return JSON.stringify(result);
    } catch (e) {
        return '[]';
    }
}

/**
 * Add a marker to the active sequence at a given time.
 * @param {string} name - Marker name.
 * @param {number} timeInSeconds - Position in seconds.
 * @param {number} duration - Duration in seconds (0 for point marker).
 * @param {number} colorIndex - Color index (0-7).
 * @returns {string} The new marker's GUID, or '' on failure.
 */
function addMarkerAtTime(name, timeInSeconds, duration, colorIndex) {
    try {
        var seq = safeGetActiveSequence();
        if (!seq) return '';

        var markers = seq.markers;
        if (!markers) return '';

        // Ensure timeInSeconds is a valid number
        var time = parseFloat(timeInSeconds);
        if (isNaN(time) || time < 0) time = 0;

        // Create the marker at the specified time
        var newMarker = markers.createMarker(time);
        if (!newMarker) return '';

        // Set name
        if (name && typeof name === 'string' && name.length > 0) {
            try {
                newMarker.name = name;
            } catch (ne) {
                // Name setting failed; marker still created
            }
        }

        // Set duration (make it a range marker)
        if (duration && parseFloat(duration) > 0) {
            try {
                var endTime = time + parseFloat(duration);
                newMarker.end = new Time();
                newMarker.end.seconds = endTime;
            } catch (de) {
                // Duration setting not supported in this Premiere version
            }
        }

        // Set color
        if (typeof colorIndex !== 'undefined') {
            var cIdx = parseInt(colorIndex, 10);
            if (!isNaN(cIdx) && cIdx >= 0 && cIdx <= 7) {
                try {
                    newMarker.setColorByIndex(cIdx);
                } catch (ce) {
                    // Color setting may not be available
                    try {
                        newMarker.colorIndex = cIdx;
                    } catch (ce2) {
                        // Ignore
                    }
                }
            }
        }

        // Return the GUID
        try {
            return newMarker.guid || '';
        } catch (ge) {
            return '';
        }
    } catch (e) {
        return '';
    }
}

/**
 * Remove a marker from the active sequence by its GUID.
 * @param {string} guid - The marker GUID to remove.
 * @returns {string} 'true' on success, 'false' on failure.
 */
function removeMarkerByGuid(guid) {
    try {
        var seq = safeGetActiveSequence();
        if (!seq) return 'false';

        var markers = seq.markers;
        if (!markers) return 'false';

        if (!guid || typeof guid !== 'string') return 'false';

        var marker = markers.getFirstMarker();
        while (marker) {
            var markerGuid = '';
            try {
                markerGuid = marker.guid || '';
            } catch (ge) {
                // GUID not accessible
            }

            if (markerGuid === guid) {
                try {
                    markers.deleteMarker(marker);
                    return 'true';
                } catch (de) {
                    return 'false';
                }
            }

            try {
                marker = markers.getNextMarker(marker);
            } catch (ne) {
                break;
            }
        }

        return 'false';
    } catch (e) {
        return 'false';
    }
}

/**
 * Update the name of a marker identified by GUID.
 * @param {string} guid - The marker GUID.
 * @param {string} newName - The new name for the marker.
 * @returns {string} 'true' on success, 'false' on failure.
 */
function updateMarkerName(guid, newName) {
    try {
        var seq = safeGetActiveSequence();
        if (!seq) return 'false';

        var markers = seq.markers;
        if (!markers) return 'false';

        if (!guid || typeof guid !== 'string') return 'false';

        var marker = markers.getFirstMarker();
        while (marker) {
            var markerGuid = '';
            try {
                markerGuid = marker.guid || '';
            } catch (ge) {
                // GUID not accessible
            }

            if (markerGuid === guid) {
                try {
                    marker.name = newName || '';
                    return 'true';
                } catch (ne) {
                    return 'false';
                }
            }

            try {
                marker = markers.getNextMarker(marker);
            } catch (ne) {
                break;
            }
        }

        return 'false';
    } catch (e) {
        return 'false';
    }
}

/**
 * Update the color of a marker identified by GUID.
 * @param {string} guid - The marker GUID.
 * @param {string} colorName - Color name (green, red, purple, orange, yellow, white, blue, cyan).
 * @returns {string} 'true' on success, 'false' on failure.
 */
function updateMarkerColor(guid, colorName) {
    try {
        var seq = safeGetActiveSequence();
        if (!seq) return 'false';

        var markers = seq.markers;
        if (!markers) return 'false';

        if (!guid || typeof guid !== 'string') return 'false';

        var cIdx = colorStringToIndex(colorName);

        var marker = markers.getFirstMarker();
        while (marker) {
            var markerGuid = '';
            try {
                markerGuid = marker.guid || '';
            } catch (ge) {}

            if (markerGuid === guid) {
                try {
                    newMarker.setColorByIndex(cIdx);
                    return 'true';
                } catch (ce) {
                    try {
                        marker.colorIndex = cIdx;
                        return 'true';
                    } catch (ce2) {
                        return 'false';
                    }
                }
            }

            try {
                marker = markers.getNextMarker(marker);
            } catch (ne) {
                break;
            }
        }

        return 'false';
    } catch (e) {
        return 'false';
    }
}

/**
 * Get the current playhead (CTI) position in seconds.
 * @returns {string} Time in seconds as a string, or '0'.
 */
function getCurrentTime() {
    try {
        var seq = safeGetActiveSequence();
        if (!seq) return '0';

        var pos = seq.getPlayerPosition();
        if (pos && typeof pos.seconds !== 'undefined') {
            return pos.seconds.toString();
        }

        // Fallback: try ticks-based conversion
        if (pos && typeof pos.ticks !== 'undefined') {
            // Premiere uses 254016000000 ticks per second
            var ticksPerSecond = 254016000000;
            var seconds = parseInt(pos.ticks, 10) / ticksPerSecond;
            return seconds.toString();
        }

        return '0';
    } catch (e) {
        return '0';
    }
}

/**
 * Navigate the playhead to a specific time in seconds.
 * @param {number} timeInSeconds - Target time in seconds.
 * @returns {string} 'true' on success, 'false' on failure.
 */
function seekToTime(timeInSeconds) {
    try {
        var seq = safeGetActiveSequence();
        if (!seq) return 'false';

        var time = parseFloat(timeInSeconds);
        if (isNaN(time) || time < 0) return 'false';

        // Create a Time object and set player position
        seq.setPlayerPosition(time.toString());
        return 'true';
    } catch (e) {
        return 'false';
    }
}

/**
 * Get basic project info.
 * @returns {string} JSON object with projectPath and projectName.
 */
function getProjectInfo() {
    try {
        var info = {};
        info.projectPath = getProjectPath();
        info.projectName = '';

        var project = app.project;
        if (project && project.name) {
            info.projectName = project.name;
        }

        return JSON.stringify(info);
    } catch (e) {
        return '{}';
    }
}

// Signal that the script has loaded successfully
'ppro-markers.jsx loaded';
