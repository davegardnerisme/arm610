
function Debugger(arm610) {
    this.arm610 = arm610;
    
    Debugger.prototype.update = function() {
        var pc = this.arm610.cpu.armRegs[15];
        var fetchedAddr = this.arm610.cpu.fetchedAddr;
        var decodedAddr = this.arm610.cpu.decodedAddr;
        var lastExcAddr = this.arm610.cpu.lastExcAddr;
        var armRegs = this.arm610.cpu.armRegs;
        var bankedRegs = this.arm610.cpu.bankedRegs;

        renderStateTable(this.arm610.cpu);
        renderRegistersTable(armRegs, bankedRegs);
        renderProgramTable(pc, fetchedAddr, decodedAddr, lastExcAddr);
        renderMemoryTable(0);
    }
    
    function renderMemoryTable(baseAddr) {
        // format into arm words (4 bytes)
        var rows = 20;
        var cols = 12;
        var addr;
        var rendered = '<dl>';
        
        for (r=0; r<rows; r++) {
            addr = baseAddr + (r*cols*4);
            rendered += '<dt>' + toHex(addr,32) + ':</dt>';
            for (c=0; c<cols; c++) {
                addr = baseAddr + (r*cols*4) + (c*4);
                var val = arm610.inspect(addr);
                rendered += '<dd>' + toHex(val, 32) + '</dd>';
            }
        }
        rendered += '</dl><div style="clear:both;"></div>';
        $('div#memory').html(rendered);
    }
    
    function renderProgramTable(pc, fetchedAddr, decodedAddr, lastExcAddr) {
        var start = pc - 10*4;
        var end = pc + 20*4;
        if (start < 0) {
            start = 0;
        }
        var rendered = '<table>';
        var val, rowClass, diss;
        for (var addr=start; addr<end; addr+=4) {
            val = arm610.inspect(addr);
            rowClass = '';
            if (addr == pc) {
                rowClass = ' class="pc"';
            } else if (addr == fetchedAddr) {
                rowClass = ' class="fetched"';
            } else if (addr == decodedAddr) {
                rowClass = ' class="decoded"';
            } else if (addr == lastExcAddr) {
                rowClass = ' class="lastexec"';
            }
            diss = dissassemble(addr, val);
            rendered += '<tr' + rowClass + '>';
            rendered += '<td class="add">' + toHex(addr,32) + ':</td>';
            rendered += '<td class="hex">0x' + toHex(val,32) + '</td>';
            rendered += '<td class="asm1">' + diss.i + '</td>';
            rendered += '<td class="asm2">' + diss.v + '</td>';
            rendered += '<td class="cond">' + getInstructionCondition(val)  + '</td>';
            rendered += '</tr>';
        }
        rendered += '</table>';
        $('div#program').html(rendered);
    }
    
    function getInstructionCondition(instruction) {
        switch (instruction >> 28 & 0xF) {
            case 0x0: // EQ - Z set (equal)
                return 'EQ - Z set (equal)';
            case 0x1: // NE - Z clear (not equal)
                return 'NE - Z clear (not equal)';
            case 0x2: // CS - C set (unsigned higher or same)
                return 'CS - C set (unsigned higher or same)';
            case 0x3: // CC - C clear (unsigned lower)
                return 'CC - C clear (unsigned lower)';
            case 0x4: // MI - N set (negative)
                return 'MI - N set (negative)';
            case 0x5: // PL - N clear (positive or zero)
                return 'PL - N clear (positive or zero)';
            case 0x6: // VS - V set (overflow)
                return 'VS - V set (overflow)';
            case 0x7: // VC - V clear (no overflow)
                return 'VC - V clear (no overflow)';
            case 0x8: // HI - C set and Z clear (unsigned higher)
                return 'HI - C set and Z clear (unsigned higher)';
            case 0x9: // LS - C clear or Z set (unsigned lower or same)
                return 'LS - C clear or Z set (unsigned lower or same)';
            case 0xA: // GE - N set and V set, or N clear and V clear (greater or equal)
                return 'GE - N set and V set, or N clear and V clear (greater or equal)';
            case 0xB: // LT - N set and V clear, or N clear and V set (less than)
                return 'LT - N set and V clear, or N clear and V set (less than)';
            case 0xC: // GT - Z clear, and either N set and V set, or N clear and V clear (greater than)
                return 'GT - Z clear, and either N set and V set, or N clear and V clear (greater than)';
            case 0xD: // LE - Z set, or N set and V clear, or N clear and V set (less than or equal)
                return 'LE - Z set, or N set and V clear, or N clear and V set (less than or equal)';
            case 0xE: // AL - always 1111
                return 'AL - always';
            case 0xF: // NV - never (not defined for ARM610)
                return 'NV - never';
        }
    }
    
    function dissassemble(addr, instruction) {
        var condition;
        var inst, vars;
        switch (instruction >> 24 & 0xF) {
            /* 0000 (data operation OR multiply) */
            case 0x0:
                if (instruction & 0xF0 == 0x90) {
                    return dissassembleMultiply(addr, instruction);
                }
                return dissassembleDataOperation(addr, instruction);
            /* 0001 (data processing OR single data swap) */
            case 0x1:
                if (instruction >> 4 & 0xFF == 0x09) {
                    return dissassembleMultiply(addr, instruction);
                }
                return dissassembleDataOperation(addr, instruction);
            /* 0010 or 0011 (data processing) */
            case 0x2:
            case 0x3:
                return dissassembleDataOperation(addr, instruction);
                break;
            /* 0011 (
            /* 01xx (single data transfer) */
            case 0x4:
            case 0x5:
            case 0x6:
            case 0x7:
                return dissassembleSingleDataTransfer(addr, instruction);
                break;
            /* 1010 (branch) */
            case 0xA:
            case 0xB:
                return dissassembleBranch(addr, instruction);
            default:
                return {i: 'unknown', v: ''}
        }
    }
    
    function dissassembleCondition(instruction) {
        switch (instruction >> 28 & 0xF) {
            case 0x0: // EQ - Z set (equal)
                return 'EQ';
            case 0x1: // NE - Z clear (not equal)
                return 'NE';
            case 0x2: // CS - C set (unsigned higher or same)
                return 'CS';
            case 0x3: // CC - C clear (unsigned lower)
                return 'CC';
            case 0x4: // MI - N set (negative)
                return 'MI';
            case 0x5: // PL - N clear (positive or zero)
                return 'PL';
            case 0x6: // VS - V set (overflow)
                return 'VS';
            case 0x7: // VC - V clear (no overflow)
                return 'VC';
            case 0x8: // HI - C set and Z clear (unsigned higher)
                return 'HI';
            case 0x9: // LS - C clear or Z set (unsigned lower or same)
                return 'LS';
            case 0xA: // GE - N set and V set, or N clear and V clear (greater or equal)
                return 'GE';
            case 0xB: // LT - N set and V clear, or N clear and V set (less than)
                return 'LT';
            case 0xC: // GT - Z clear, and either N set and V set, or N clear and V clear (greater than)
                return 'GT';
            case 0xD: // LE - Z set, or N set and V clear, or N clear and V set (less than or equal)
                return 'LE';
            case 0xE: // AL - always 1111
                return '';
            case 0xF: // NV - never (not defined for ARM610)
                return 'NV';
        }
    }
    
    function dissassembleBranch(addr, instruction) {
        var instr;
        var offset = ((instruction << 8) >> 6) + 8;
        if (instruction >> 24 & 0xF == 0xB) {
            instr = 'BL';
        } else {
            instr = 'B';
        }
        return {i: instr + dissassembleCondition(instruction), v: offset }
    }
    
    function dissassembleDataOperation(addr, instruction) {
        var op = (instruction>>21) & 0xF;
        // first operand; always reg
        var rn = (instruction>>16) & 0xF;

        // second operand depends on immediate bit
        var immediate = instruction & 0x2000000;
        var set = instruction       & 0x0100000;
        var rd = (instruction>>12) & 0xF;
        
        var inst;
        switch (op) {
            case 0x0: // AND - Rd:= Op1 AND Op2 
                inst = 'AND';
                break;
            case 0x1: // EOR - Rd:= Op1 EOR Op2
                inst = 'EOR';
                break;
            case 0x2: // SUB - Rd:= Op1 - Op2
                inst = 'SUB';
                break;
            case 0x3: // RSB - Rd:= Op2 - Op1
                inst = 'RSB';
                break;
            case 0x4: // ADD - Rd:= Op1 + Op2
                inst = 'ADD';
                break;
            case 0x5: // ADC - Rd:= Op1 + Op2 + C
                inst = 'ADC';
                break;
            case 0x6: // SBC - Rd:= Op1 - Op2 + C - 1
                inst = 'SBC';
                break;
            case 0x7: // RSC - Rd:= Op2 - Op1 + C - 1
                inst = 'RSC';
                break;
            case 0x8: // TST - set condition codes on Op1 AND Op2
                inst = 'TST';
                break;
            case 0x9: // TEQ - set condition codes on Op1 EOR Op2
                inst = 'TEQ';
                break;
            case 0xA: // CMP - set condition codes on Op1 - Op2
                inst = 'CMP';
                break;
            case 0xB: // CMN - set condition codes on Op1 + Op2
                inst = 'CMN';
                break;
            case 0xC: // ORR - Rd:= Op1 OR Op2
                inst = 'ORR';
                break;
            case 0xD: // MOV - Rd:= Op2
                inst = 'MOV';
                break;
            case 0xE: // BIC - Rd:= Op1 AND NOT Op2
                 inst = 'BIC';
                break;
            case 0xF: // MVN - Rd:= NOT Op2
                 inst = 'MVN';
                break;
        }
        
        // add condition
        inst += dissassembleCondition(instruction);
        
        // add set bit
        if (set > 0) {
            inst += 'S';
        }
        
        // figure out op2
        var expr;
        if (immediate == 0) {
            var rm = instruction & 0xF;
            expr = 'R' + rm;
            var shift = (instruction >> 4) & 0xF;
            var shiftType;
            switch (shift >> 1 & 0x3) {
                case 0x0:   // logical shift left
                    shiftType = 'LSL';
                    break;
                case 0x1:   // logical shift right
                    shiftType = 'LSR';
                    break;
                case 0x2:   // arithmatic shift right
                    shiftType = 'ASR';
                    break;
                case 0x3:   // rotate right
                    shiftType = 'ROR';
                    break;
            }
            
            if (shift & 0x1 > 0) {
                // shift amount specified by register - specifically the
                // bottom byte of said reg
                var rs = shift >> 4 & 0xF;
                expr += ',' + shiftType + ' R' + rs;
            } else {
                // shift amount specified as 5 bit unsigned integer
                var shiftAmount = rd >> 3 & 0x1F;
                if (shiftAmount > 0) {
                    expr += ',' + shiftType + '#' + shiftAmount;
                }
            }
        } else {
            // immediate rotated value
            var offset = instruction & 0xFF;
            var rotate = (instruction >> 8) & 0xF;
            if (rotate > 0) {
                expr += 'ROR '
            }
            expr = '#' + offset;
        }
        
        // 3 formats depending on op
        var val;
        switch (op) {
            case 0x8: // TST - set condition codes on Op1 AND Op2
            case 0x9: // TEQ - set condition codes on Op1 EOR Op2
            case 0xA: // CMP - set condition codes on Op1 - Op2
            case 0xB: // CMN - set condition codes on Op1 + Op2
                /* <opcode>{cond} Rn,<Op2> */
                val = 'R' + rn + ',' + expr;
                break;
            case 0xD: // MOV - Rd:= Op2
            case 0xF: // MVN - Rd:= NOT Op2
                /* <opcode>{cond}{S} Rd,<Op2> */
                val = 'R' + rn + ',' + expr;
                break;
            default:
                /* <opcode>{cond}{S} Rd,Rn,<Op2> */
                val = 'R' + rd + ',R' + rn + ',' + expr;
                break;
        }
        return {i: inst, v: val}
    }
    
    function dissassembleMultiply(addr, instruction) {
        return {i: '{MUL}', v: ''}
    }
    
    function dissassembleSingleDataTransfer(addr, instruction) {
        var immediate = instruction         & 0x2000000;
        var prePostIndexing = instruction   & 0x1000000;
        var upDown = instruction            & 0x0800000;
        var byteWord = instruction          & 0x0400000;
        var writeBack = instruction         & 0x0200000;
        var loadStore = instruction         & 0x0100000;

        var rn = (instruction>>16) & 0xF;   // base reg
        var rd = (instruction>>12) & 0xF;   // source/dest reg
        var offset = instruction & 0xFFF;
        
        var inst;
        
        if (loadStore == 0) {
            inst = 'STR';
        } else {
            inst = 'LDR';
        }
        inst += dissassembleCondition(instruction);
        if (byteWord > 0) {
            inst += 'B';
        }
        if (prePostIndexing == 0) {
            inst += 'T';
        }
        
        var val;
        val = 'R' + rd + ',';
        
        // work out offset
        var offsetInst  = '';
        if (immediate == 0) {
//            if (offset > 0) {
                offsetInst = ',#' + offset;
//            }
        } else {
            var rm = instruction & 0xF;
            var shift = (instruction >> 4) & 0xFF;
            var shiftType;
            switch (shift >> 1 & 0x3) {
                case 0x0:   // logical shift left
                    shiftType = 'LSL';
                    break;
                case 0x1:   // logical shift right
                    shiftType = 'LSR';
                    break;
                case 0x2:   // arithmatic shift right
                    shiftType = 'ASR';
                    break;
                case 0x3:   // rotate right
                    shiftType = 'ROR';
                    break;
            }
            offsetInst = ',';
            if (upDown == 0) {
                offsetInst += '-';
            }
            offsetInst += 'R' + rm;
            var shiftAmount = rd >> 3 & 0x1F;
            if (shiftAmount > 0) {
                 offsetInst += ',' + shiftType + '#' + shiftAmount;
            }
        }
        
        // add address
        if (prePostIndexing == 0) {
            // post-index
        } else {
            // pre-index
            val += '[R' + rn + offsetInst + ']';
            if (writeBack > 0) {
                val += '!';
            }
        }
        
        return {i: inst, v: val}
        
        // figure out offset if not immediate
        // (immediate == offset value is a 12 bit unsigned integer)
        /*
        if (immediate == 0) {

            // @todo this is broken, probably -- we should be shifting the register value

            // ofset value is shifted register (rm)
            var rm = offset & 0xF;
            var shiftType = rd & 0x60;
            var shiftAmount = rd >> 7 & 0x1F;
            switch (shiftType) {
                case 0x0:   // logical shift left
                    rm = rm << shiftAmount;
                    break;
                case 0x1:   // logical shift right
                    rm = rm >>> shiftAmount;
                    break;
                case 0x2:   // arithmatic shift right
                    rm = rm >> shiftAmount;
                    break;
                case 0x3:   // rotate right
                    rm = rm | (rm << 0xF);
                    rm = rm >> shiftAmount;
                    rm = rm & 0xF;
                    break;
            }
            offset = rm;
        }

        var addr = cpu.armRegs[rn]; // base reg

        // pre-index? (add offset before)
        if (prePostIndexing > 0) {
            if (upDown == 0) {
                addr -= offset;
                console.log('Pre-index - ' + offset);
            } else {
                addr += offset;
                console.log('Pre-index + ' + offset);
            }
        }

        if (loadStore == 0) {

            // @todo fix up the memory interface so we're not going direct'

            // store
            if (byteWord == 0) {
                // word
                cpu.mmu.write32(addr, cpu.armRegs[rd]);
                console.log('Store word ' + addr + ' -> reg#' + rd);
            } else {
                // byte
                cpu.mmu.write8(addr, cpu.armRegs[rd]);
                console.log('Store byte ' + addr + ' -> reg#' + rd);
            }
        } else {
            // load
            if (byteWord == 0) {
                // word
                cpu.armRegs[rd] = cpu.mmu.read32(addr);
                console.log('Read word ' + addr + ' <- reg#' + rd);
            } else {
                // byte
                cpu.armRegs[rd] = cpu.mmu.read8(addr);
                console.log('Read byte ' + addr + ' <- reg#' + rd);
            }
        }

        // post-index? (add offset after)
        if (prePostIndexing == 0) {
            if (upDown == 0) {
                addr -= offset;
            } else {
                addr += offset;
            }
        }

        // write back?
        if (writeBack > 0) {
            cpu.armRegs[rn] = addr;
        }
        */
    }
    
    function renderRegistersTable(armRegs, bankedRegs) {
        var rendered = '';
        var i, title;
        
        // arm first
        rendered += '<div class="armreg"><h4>ARM registers</h4><dl>';
        for (i=0; i<=17; i++) {
            switch (i) {
                case 15:
                    title = 'R15 (PC)';
                    break;
                case 16:
                    title = 'CPSR';
                    break;
                case 17:
                    title = 'SPSR';
                    break;
                default:
                    title = 'R' + i;
                    break;
            }
            rendered += '<dt>' + title + '</dt>';
            rendered += '<dd>0x' + toHex(armRegs[i], 32) + '</dd>';
        }
        rendered += '</dl></div>';
        
        // banked
        rendered += '<div class="bankedreg"><h4>Banked registers</h4><dl>';
        for (i=0; i<=19; i++) {
            switch (i) {
                case 0: title = 'R8 FIQ'; break;
                case 1: title = 'R9 FIQ'; break;
                case 2: title = 'R10 FIQ'; break;
                case 3: title = 'R11 FIQ'; break;
                case 4: title = 'R12 FIQ'; break;
                case 5: title = 'R13 FIQ'; break;
                case 6: title = 'R14 FIQ'; break;
                case 7: title = 'SPSR FIQ'; break;
                case 8: title = 'R13 SVC'; break;
                case 9: title = 'R14 SVC'; break;
                case 10: title = 'SPSR SVC'; break;
                case 11: title = 'R13 ABT'; break;
                case 12: title = 'R14 ABT'; break;
                case 13: title = 'SPSR ABT'; break;
                case 14: title = 'R13 IRQ'; break;
                case 15: title = 'R14 IRQ'; break;
                case 16: title = 'SPSR IRQ'; break;
                case 17: title = 'R13 UND'; break;
                case 18: title = 'R14 UND'; break;
                case 19: title = 'SPSR UND'; break;
            }
            rendered += '<dt>' + title + '</dt>';
            rendered += '<dd>0x' + toHex(bankedRegs[i], 32) + '</dd>';
        }
        rendered += '</dl></div>';
        
        // finish
        rendered += '<div style="clear:both;float:none;"></div>';
        
        $('div#registers').html(rendered);
    }
    
    function renderStateTable(cpu) {
        var rendered = '<dl>';
        rendered += '<dt>Cycles</dt><dd>' + cpu.cycles + '</dd>';
        rendered += '<dt>Mode</dt><dd>' + cpu.getMode() + '</dd>';
        rendered += '<dt>PC</dt><dd>0x' + toHex(cpu.armRegs[15], 32) + '</dd>';
        rendered += '<dt>Fetched</dt><dd>0x' + toHex(cpu.fetched, 32) + '</dd>';
        rendered += '<dt>Decoded</dt><dd>0x' + toHex(cpu.decoded, 32) + '</dd>';
        rendered += '</dl><div style="clear:both;"></div>';
        $('div#state').html(rendered);
    }
    
    function toHex(r, bits) {
        r = Number(r);
        if (r < 0) {
            r = 0xFFFFFFFF + r + 1;
        }
            
        var t = r.toString(16);
            
        if (bits) {
            var len = Math.floor(bits / 4); // 4 bits per hex char
            while (t.length < len) {
                t = '0' + t;
            }
        }
            
        return t;
    }
        
    function toString8(v) {
        return '0x' + toHex((v&0xff)>>>0, 8);
    }
    function toString16(v) {
        return '0x' + toHex((v&0xffff)>>>0, 16);
    }
    function toString32(v) {
        return '0x' + toHex(v, 32);
    }

}
